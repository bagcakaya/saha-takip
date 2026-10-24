export interface GeolocationResult {
  latitude: number;
  longitude: number;
  altLatitude?: number;
  altLongitude?: number;
  address?: string;
  accuracy?: number | null;
  isMocked?: boolean;
}

export interface WorkplaceTargetCoords {
  latitude: number;
  longitude: number;
  altLatitude?: number;
  altLongitude?: number;
  radius?: number;
}

export interface AddressSearchResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

// Memory cache for reverse-geocoded addresses to avoid repeat network requests
const geocodeCache = new Map<string, string>();

// Son doğrulanmış konum (Işınlanma / ani sıçrama tespiti)
let lastVerifiedPositionWeb: { latitude: number; longitude: number; timestamp: number } | null = null;

// Son 120 saniyelik doğrulanmış GPS okumaları tamponu (Android & iPhone iç mekan sinyal sıçraması koruyucusu)
// Ekranda 7-8m gösterip "İşe Geldim / İşten Çıkıyorum" tuşuna basınca anlık bina yansımasıyla 35-36m'ye sıçramasını önler.
interface BufferedPositionEntry {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address?: string;
  timestamp: number;
}
const recentPositionsBuffer: BufferedPositionEntry[] = [];

function recordBufferedPosition(lat: number, lon: number, acc?: number | null, addr?: string) {
  if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
  const now = Date.now();
  // 120 saniyeden eski kayıtları temizle
  while (recentPositionsBuffer.length > 0 && now - recentPositionsBuffer[0].timestamp > 120000) {
    recentPositionsBuffer.shift();
  }
  recentPositionsBuffer.push({
    latitude: lat,
    longitude: lon,
    accuracy: acc ?? null,
    address: addr,
    timestamp: now,
  });
  if (recentPositionsBuffer.length > 30) {
    recentPositionsBuffer.shift();
  }
}

// Arka plan GPS ön hazırlık ve ısıtma tamponu (0ms refleks)
let warmCachedPosition: GeolocationResult | null = null;
let warmCachedTimestamp = 0;
let locationWatchId: number | null = null;
let isPrewarmingActive = false;

// Query single getCurrentPosition with custom options as a Promise
function queryPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// Watch position and pick the sharpest satellite GPS lock (avoids Android's coarse 1st Wi-Fi callback)
function watchBestPosition(
  options: PositionOptions,
  timeoutMs: number,
  desiredAccuracyMeters = 15,
  settleWindowMs = 1500
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let timer: any = null;
    let settleTimer: any = null;
    let bestPos: GeolocationPosition | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {}
        watchId = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
    };

    timer = setTimeout(() => {
      cleanup();
      if (bestPos) {
        resolve(bestPos);
      } else {
        reject(new Error('WATCH_TIMEOUT'));
      }
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = pos.coords.accuracy ?? 999;
          recordBufferedPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);

          if (!bestPos || acc <= (bestPos.coords.accuracy ?? 999)) {
            bestPos = pos;
          }

          // Uydu kilidi istenen hassasiyete (örn. <=15m) ulaştıysa anında döndür!
          if (acc <= desiredAccuracyMeters) {
            cleanup();
            resolve(bestPos);
            return;
          }

          // İlk gelen okuma kaba Wi-Fi/Hücresel ise (Android FusedLocation 1. callback),
          // gerçek GPS uydusunun (2. callback) gelmesi için kısa settleWindowMs kadar bekle
          if (!settleTimer) {
            settleTimer = setTimeout(() => {
              if (bestPos) {
                const resolved = bestPos;
                cleanup();
                resolve(resolved);
              }
            }, settleWindowMs);
          }
        },
        (err) => {
          // İzin reddedildiyse hemen sonlandır
          if (err.code === 1) {
            cleanup();
            reject(err);
            return;
          }
          // Android Chrome ve iOS Safari cihazlarda GPS donanımı uyanırken
          // ilk 1-2 saniye geçici POSITION_UNAVAILABLE (code 2) veya TIMEOUT (code 3) hatası atabilir.
          // Bu durumda hemen reject ETME! Uyduların kilitlenmesini bekle (timeoutMs süresince dinlemeye devam et).
          console.warn('watchPosition geçici uyarı (uydu aranıyor):', err?.message || err);
        },
        options
      );
    } catch (e) {
      cleanup();
      reject(e);
    }
  });
}

export const LocationService = {
  /**
   * Retrieves user's current GPS position via browser Geolocation API
   * Çok Katmanlı (Multi-Tier) Yüksek Hassasiyetli GPS Algılama Mimarisi:
   * 1. Öncelikle gerçek donanım GPS uydusu (enableHighAccuracy: true) beklenir (Android kaba Wi-Fi sapmasını önler).
   * 2. Depo, bodrum, kapalı alanda GPS uydusu hiç yanıt vermezse ağ/hücresel konum devreye sokulur.
   * 3. Son doğrulanmış konum tamponu ve net hata yönetimi (Konum açıkken asla "kapalı" demez).
   */
  async getCurrentPosition(options?: PositionOptions): Promise<GeolocationResult> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const err: any = new Error('Cihazınız veya tarayıcınız konum servislerini desteklemiyor.');
      err.isLocationDisabled = true;
      throw err;
    }

    let position: GeolocationPosition | null = null;
    let lastError: any = null;
    let permissionDeniedError: any = null;

    const isFreshCalibration = options?.maximumAge === 0;

    // A. Yüksek Hassasiyetli GPS Alıcısı (Öncelikli - Uydu Kilidi)
    const gpsPromise = watchBestPosition(
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: isFreshCalibration ? 0 : 15000,
        ...options,
      },
      isFreshCalibration ? 5500 : 5000,
      isFreshCalibration ? 10 : 15,
      isFreshCalibration ? 2200 : 1400
    ).catch((err) => {
      if (err?.code === 1) {
        permissionDeniedError = err;
      } else {
        lastError = err;
      }
      return null;
    });

    // B. Yedek Ağ / Önbellek Konumu (Sadece GPS uydusu kapalı alanda kilitlenemezse kullanılır)
    const fastPromise = queryPosition({
      enableHighAccuracy: false,
      timeout: 3500,
      maximumAge: isFreshCalibration ? 0 : 60000,
    }).catch((err) => {
      if (err?.code === 1) {
        permissionDeniedError = err;
      } else {
        lastError = err;
      }
      return null;
    });

    try {
      // 1. Önce gerçek Yüksek Hassasiyetli GPS uydusunu bekle (2.6 saniye)
      // Böylece Android cihazlarda ilk 50ms'de gelen 35-40m sapmalı kaba Wi-Fi konumu yerine gerçek GPS alınır!
      const gpsResult = await Promise.race([
        gpsPromise,
        new Promise<null>((res) => setTimeout(() => res(null), isFreshCalibration ? 3500 : 2600)),
      ]);

      if (permissionDeniedError) {
        throw permissionDeniedError;
      }

      if (gpsResult) {
        position = gpsResult;
      } else {
        // 2. GPS 2.6 saniyede yanıt vermediyse (kapalı bina/bodrum), yedek ağ konumunu kontrol et
        const fullFast = await fastPromise;
        if (permissionDeniedError) {
          throw permissionDeniedError;
        }
        if (fullFast) {
          position = fullFast;
          recordBufferedPosition(fullFast.coords.latitude, fullFast.coords.longitude, fullFast.coords.accuracy);
        } else {
          // 3. Son çare GPS'in kalan süresini bekle
          position = await gpsPromise;
          if (permissionDeniedError) {
            throw permissionDeniedError;
          }
        }
      }
    } catch (permErr: any) {
      if (permErr?.code === 1) {
        const customErr: any = new Error('Konum izni verilmedi. İşe giriş/çıkış için lütfen tarayıcınızdan konum iznini açın.');
        customErr.code = 1;
        customErr.isLocationDisabled = true;
        throw customErr;
      }
      lastError = permErr;
    }

    // AŞAMA 4: Depo, bodrum, kapalı alanda son çare hücresel / wifi ağ sorgusu
    if (!position) {
      try {
        position = await queryPosition({
          enableHighAccuracy: false,
          timeout: 4000,
          maximumAge: 300000,
        });
      } catch (netErr: any) {
        lastError = netErr;
        if (netErr?.code === 1) {
          const permErr: any = new Error('Konum izni verilmedi. İşe giriş/çıkış için lütfen tarayıcınızdan konum iznini açın.');
          permErr.code = 1;
          permErr.isLocationDisabled = true;
          throw permErr;
        }
      }
    }

    // AŞAMA 5: Son Çare - Mevcut oturumda son 5 dakika içinde doğrulanmış konum varsa onu kullan
    if (!position && lastVerifiedPositionWeb) {
      const now = Date.now();
      if (now - lastVerifiedPositionWeb.timestamp < 300000) {
        return {
          latitude: lastVerifiedPositionWeb.latitude,
          longitude: lastVerifiedPositionWeb.longitude,
          accuracy: 50,
          address: `${lastVerifiedPositionWeb.latitude.toFixed(6)}, ${lastVerifiedPositionWeb.longitude.toFixed(6)}`,
        };
      }
    }

    // Eğer tüm aşamalar başarısız olduysa net ve doğru hata mesajı üret
    if (!position) {
      let msg = 'Konum bilgisi alınamadı. Lütfen açık alana geçerek tekrar deneyin.';
      let isLocDisabled = false;
      if (lastError?.code === 1) {
        msg = 'Konum izni verilmedi. İşe giriş ve çıkış yapabilmek için lütfen tarayıcı ve cihaz ayarlarından konum iznini açın.';
        isLocDisabled = true;
      } else if (lastError?.code === 2) {
        msg = 'Cihazınızın GPS sinyali alınamıyor veya bina içindesiniz. Lütfen açık alana veya pencere kenarına geçerek tekrar deneyin.';
      } else if (lastError?.code === 3 || lastError?.message === 'TIMEOUT' || lastError?.message === 'WATCH_TIMEOUT') {
        msg = 'GPS uydu bağlantısı zaman aşımına uğradı. Lütfen cihazınızı açık alanda tutarak tekrar deneyin.';
      }
      const customError: any = new Error(msg);
      customError.code = lastError?.code;
      customError.isLocationDisabled = isLocDisabled;
      throw customError;
    }

    // Konum Doğrulama & Sahte Konum Güvenlik Kontrolleri:
    const { latitude, longitude, accuracy } = position.coords;
    const now = Date.now();

    // 1. Sentetik / Sıfır Accuracy Kontrolü (DevTools Geolocation Spoofing tespiti)
    if (accuracy !== null && accuracy !== undefined && accuracy <= 0.0001) {
      const err: any = new Error(
        '🚨 SAHTE KONUM TESPİT EDİLDİ (Sentetik GPS / Tarayıcı Emülatör Sinyali)!\n\nTarayıcı veya üçüncü parti eklenti tarafından üretilen yapay konum saptandı. Yalnızca cihazın orijinal GPS konumu kabul edilmektedir.'
      );
      err.isMockLocation = true;
      throw err;
    }

    // 2. İşletim sistemi sahte konum bayrağı
    if ((position as any).mocked === true || (position.coords as any)?.mocked === true) {
      const err: any = new Error(
        '🚨 SAHTE KONUM TESPİT EDİLDİ!\n\nCihazınızda sahte konum yazılımı tespit edildi. Lütfen sahte konum yazılımlarını kapatın.'
      );
      err.isMockLocation = true;
      throw err;
    }

    // 3. Işınlanma / Teleportation kontrolü (Yalnızca mantıksız sıçramalar: >2km ve >300 km/s)
    if (lastVerifiedPositionWeb) {
      const timeDiffSec = (now - lastVerifiedPositionWeb.timestamp) / 1000;
      if (timeDiffSec > 0 && timeDiffSec < 60) {
        const dist = LocationService.calculateDistance(
          lastVerifiedPositionWeb.latitude,
          lastVerifiedPositionWeb.longitude,
          latitude,
          longitude
        );
        const speedKmh = (dist / timeDiffSec) * 3.6;
        if (dist > 2000 && speedKmh > 300) {
          const err: any = new Error(
            '🚨 Şüpheli ani konum değişikliği tespit edildi (Işınlanma engellendi)! Lütfen sahte konum yazılımlarını kapatın.'
          );
          err.isMockLocation = true;
          throw err;
        }
      }
    }

    lastVerifiedPositionWeb = { latitude, longitude, timestamp: now };

    let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    try {
      const geocodePromise = LocationService.reverseGeocode(latitude, longitude);
      const timeoutPromise = new Promise<string>((res) => setTimeout(() => res(''), 700));
      const fastAddr = await Promise.race([geocodePromise, timeoutPromise]);
      if (fastAddr) address = fastAddr;
    } catch (e) {
      console.warn('Reverse geocoding skipped/timeout:', e);
    }

    const finalAddr = address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    recordBufferedPosition(latitude, longitude, accuracy, finalAddr);
    warmCachedPosition = {
      latitude,
      longitude,
      accuracy,
      address: finalAddr,
    };
    warmCachedTimestamp = now;

    return {
      latitude,
      longitude,
      accuracy,
      address: finalAddr,
    };
  },

  /**
   * Yerinde 20m İş Yeri / Şube Kalibrasyonu İçin Özel Hassas GPS Okuyucu:
   * Yönetici "Konumu Yerinde Güncelle (GPS)" dediğinde hem gerçek uydu GPS koordinatını (enableHighAccuracy: true, maximumAge: 0)
   * hem de aynı binanın iç mekan Wi-Fi/Ağ referans noktasını (65m içindeyse altLatitude/altLongitude olarak) yakalar.
   * Böylece hem iPhone (CoreLocation) hem Android (Fused GPS / Wi-Fi) cihazlar aynı binada %100 20m içinde görünür.
   */
  async getHighAccuracyCalibrationPosition(): Promise<GeolocationResult> {
    // Önce önbelleği sıfırla ki eski koordinat kullanılmasın
    warmCachedPosition = null;
    warmCachedTimestamp = 0;

    // Eşzamanlı olarak iç mekan ağ noktasını da (varsa) yakala
    const networkAnchorPromise = queryPosition({
      enableHighAccuracy: false,
      timeout: 3000,
      maximumAge: 0,
    }).catch(() => null);

    // Gerçek uydu GPS kilidini (maximumAge: 0) al
    const primaryGps = await LocationService.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    const netPos = await networkAnchorPromise;
    if (netPos && netPos.coords) {
      const distBetween = LocationService.calculateDistance(
        primaryGps.latitude,
        primaryGps.longitude,
        netPos.coords.latitude,
        netPos.coords.longitude
      );
      // Eğer aynı binanın Wi-Fi/Hücresel noktası ile GPS uydusu arasında 3m - 65m iç mekan farkı varsa ikincil çapa olarak kaydet
      if (distBetween >= 3 && distBetween <= 65) {
        primaryGps.altLatitude = netPos.coords.latitude;
        primaryGps.altLongitude = netPos.coords.longitude;
      }
    }

    return primaryGps;
  },

  /**
   * Reverse geocodes coordinates to street address using OpenStreetMap Nominatim
   * Includes 1.5-second hard timeout and in-memory cache to prevent blocking UI
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (geocodeCache.has(key)) {
      return geocodeCache.get(key)!;
    }

    const fallbackCoord = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000); // 3s timeout for reliable network response

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          signal: controller.signal,
          headers: {
            'Accept-Language': 'tr',
          },
        }
      );
      clearTimeout(timer);

      if (!response.ok) {
        return fallbackCoord;
      }
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.street || '';
        const houseNumber = addr.house_number ? `No: ${addr.house_number}` : '';
        const roadWithNumber = [road, houseNumber].filter(Boolean).join(' ');
        let suburb = addr.neighbourhood || addr.suburb || addr.quarter || '';
        const district = addr.district || addr.town || addr.county || '';
        const city = addr.city || addr.province || addr.state || '';

        // Erzurum Palandöken 12 Mart Caddesi özelinde:
        // OpenStreetMap sınırında Müftü Solakzade Mahallesi ile Adnan Menderes Mahallesi komşudur.
        // Eğer display_name içerisinde Müftü Solakzade geçiyorsa veya cadde 12 Mart Caddesi ise ve kullanıcı Müftü Solakzade tarafındaysa:
        if (
          data.display_name &&
          (data.display_name.toLowerCase().includes('müftü solakzade') || data.display_name.toLowerCase().includes('müftüsolakzade')) &&
          suburb.toLowerCase().includes('adnan menderes')
        ) {
          suburb = 'Müftü Solakzade Mahallesi';
        }

        const parts = [roadWithNumber, suburb, district, city].filter(Boolean);
        const resolved = parts.length > 0 ? parts.join(', ') : (data.display_name || fallbackCoord);
        geocodeCache.set(key, resolved);
        return resolved;
      }
      return fallbackCoord;
    } catch {
      return fallbackCoord;
    }
  },

  /**
   * Opens Google Maps in a new tab with query
   */
  openInGoogleMaps(address?: string, lat?: number, lon?: number): void {
    let query = '';
    if (lat && lon) {
      query = `${lat},${lon}`;
    } else if (address) {
      query = encodeURIComponent(address.trim());
    }

    if (query) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
    }
  },

  /**
   * Calculates distance in meters between two GPS coordinates using Haversine formula
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place
  },

  /**
   * İş Yeri / Şube Akıllı Mesafe Hesaplayıcı (Android & iPhone İç Mekan GPS Sapma Korumalı):
   * 1. Hem ana GPS koordinatını hem de (varsa ve aynı binadaysa <=70m) ikincil iç mekan/Wi-Fi çapasını kontrol eder.
   * 2. Son 90 saniye içinde aynı binada (<65m) doğrulanmış daha net bir okuma varsa (ekranda 7-8m gösterip butona basınca 35-36m'ye sıçrama durumu) onu korur.
   * 3. Bina içi beton tavan / cam yansıması (multipath) kaynaklı 20m-48m arası GPS sapmalarında cihazın accuracy yarıçapını dikkate alır.
   */
  calculateWorkplaceDistance(
    userLat: number,
    userLon: number,
    target: WorkplaceTargetCoords,
    userAccuracy?: number | null
  ): number {
    const computeRawMin = (lat: number, lon: number): number => {
      let d = LocationService.calculateDistance(lat, lon, target.latitude, target.longitude);
      if (
        typeof target.altLatitude === 'number' &&
        typeof target.altLongitude === 'number' &&
        target.altLatitude !== 0 &&
        target.altLongitude !== 0
      ) {
        const anchorSpread = LocationService.calculateDistance(
          target.latitude,
          target.longitude,
          target.altLatitude,
          target.altLongitude
        );
        if (anchorSpread <= 75) {
          const dAlt = LocationService.calculateDistance(lat, lon, target.altLatitude, target.altLongitude);
          if (dAlt < d) d = dAlt;
        }
      }
      return d;
    };

    let bestRawDist = computeRawMin(userLat, userLon);

    // Son 90 saniye içinde personelin ekranında doğrulanmış ve aynı binada (<65m) olan okumaları kontrol et
    // (Örn: Ekranda 7-8m gösterirken "İşe Geldim"e basınca GPS'in anlık 35-36m'ye zıplamasını engeller)
    const now = Date.now();
    for (let i = recentPositionsBuffer.length - 1; i >= 0; i--) {
      const entry = recentPositionsBuffer[i];
      if (now - entry.timestamp > 90000) continue;
      const driftFromCurrent = LocationService.calculateDistance(userLat, userLon, entry.latitude, entry.longitude);
      // Kullanıcı aynı noktadaysa (65m'den fazla uzaklaşmamışsa)
      if (driftFromCurrent <= 65) {
        const entryDist = computeRawMin(entry.latitude, entry.longitude);
        if (entryDist < bestRawDist) {
          bestRawDist = entryDist;
        }
      }
    }

    const allowedRadius = target.radius || 20;

    // Zaten 20m sınırının içindeyse doğrudan gerçek mesafeyi döndür
    if (bestRawDist <= allowedRadius) {
      return bestRawDist;
    }

    // İç Mekan (Bina İçi) GPS Multipath / Accuracy Toleransı:
    // Personel tam iş yeri binasındaysa (ham mesafe 20m ile 46m arasındaysa - yani başka bir sokakta/uzakta değilse)
    // iPhone ve Android'in bina içindeki 15m-35m'lik doğal GPS sapma yarıçapını (accuracy) telafi et:
    if (bestRawDist <= 46) {
      const deviceAcc = userAccuracy && userAccuracy > 5 ? Math.min(userAccuracy * 0.75, 26) : 22;
      if (bestRawDist - deviceAcc <= allowedRadius) {
        const compensated = Math.max(6.5, Math.min(allowedRadius - 1.5, bestRawDist - deviceAcc * 0.85));
        return Math.round(compensated * 10) / 10;
      }
    }

    return bestRawDist;
  },

  /**
   * Formats distance nicely in Turkish (e.g. "8.4 metre" or "1.2 km")
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters * 10) / 10} metre`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  },

  /**
   * Searches address and returns coordinates using OpenStreetMap Nominatim with intelligent Turkish address fallbacks
   */
  async searchAddress(query: string): Promise<AddressSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    // Clean out typical non-geocodable additions like "No:44", "Kat: 2", "Daire: 5", "Apt.", "Sitesi"
    const cleaned = trimmed
      .replace(/\b(no\s*[:\.]?\s*\d+[a-zA-Z]?|no\s+\d+[a-zA-Z]?|\bno\.\d+)\b/gi, '')
      .replace(/\b(daire|d\s*:\s*\d+|kat|apt|apartman[ıi]|sitesi|blok|iş\s*merkezi|plaza)\s*[:#]?\s*\w+/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/,\s*,/g, ',')
      .replace(/^,\s*|,\s*$/g, '')
      .trim();

    const searchQueries: string[] = [trimmed];
    if (cleaned && cleaned !== trimmed) {
      searchQueries.push(cleaned);
    }

    const parts = (cleaned || trimmed).split(/[,/]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const street = parts.find((p) => /cadd?e|sokak|bulvar|yol/i.test(p));
      const mahalle = parts.find((p) => /mahal?le/i.test(p));
      const others = parts.filter((p) => p !== street && p !== mahalle);

      if (street && others.length > 0) {
        searchQueries.push([street, ...others].join(', '));
      }
      if (mahalle && others.length > 0) {
        searchQueries.push([mahalle, ...others].join(', '));
      }
      if (street && others.length > 1) {
        searchQueries.push([street, others[others.length - 1]].join(', '));
      }
    }

    const uniqueQueries = [...new Set(searchQueries.filter(Boolean))];

    for (const q of uniqueQueries) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'tr',
            },
          }
        );
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => ({
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name,
          }));
        }
      } catch {
        // try next fallback query
      }
    }
    return [];
  },

  /**
   * Arka Plan Konum Ön Hazırlık Ajanı (Background GPS Pre-warmer):
   * Uygulama açıkken uyduları ve GPS sensörünü sessizce uyanık tutar.
   * Kullanıcı butona bastığı anda konumu 0 milisaniyede sağlar.
   */
  startPrewarming(): void {
    if (typeof window === 'undefined' || !navigator.geolocation || isPrewarmingActive) return;
    try {
      isPrewarmingActive = true;
      locationWatchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          const now = Date.now();

          // Işınlanma ve sahte konum kontrolü
          if (lastVerifiedPositionWeb && acc !== null && acc < 100) {
            const timeDiffSec = Math.max(1, (now - lastVerifiedPositionWeb.timestamp) / 1000);
            if (timeDiffSec < 60) {
              const dist = LocationService.calculateDistance(
                lastVerifiedPositionWeb.latitude,
                lastVerifiedPositionWeb.longitude,
                lat,
                lon
              );
              const speedKmh = (dist / timeDiffSec) * 3.6;
              if (dist > 2000 && speedKmh > 300) {
                console.warn('Pre-warming: Şüpheli ani konum sıçraması engellendi.');
                return;
              }
            }
          }

          let address = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
          try {
            const cachedAddr = await LocationService.reverseGeocode(lat, lon);
            if (cachedAddr) address = cachedAddr;
          } catch {}

          recordBufferedPosition(lat, lon, acc, address);

          // Eğer önbellekte zaten son 25 saniyeye ait çok net bir uydu konumu (<=18m) varsa,
          // bina içi anlık kaba sıçramanın (acc > 28m ve <65m mesafe) sıcak konumu bozmasına izin verme!
          if (
            warmCachedPosition &&
            now - warmCachedTimestamp < 25000 &&
            warmCachedPosition.accuracy != null &&
            warmCachedPosition.accuracy <= 18 &&
            acc != null &&
            acc > 28
          ) {
            const drift = LocationService.calculateDistance(
              warmCachedPosition.latitude,
              warmCachedPosition.longitude,
              lat,
              lon
            );
            if (drift <= 65) {
              return;
            }
          }

          warmCachedPosition = {
            latitude: lat,
            longitude: lon,
            accuracy: acc,
            address,
          };
          warmCachedTimestamp = now;
          lastVerifiedPositionWeb = { latitude: lat, longitude: lon, timestamp: now };
        },
        (err) => {
          // Arka plan izleme geçici uydu arama mesajları
          console.debug('[Konum Ajanı] Arka plan GPS dinleme notu:', err?.message || err);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 20000,
          timeout: 10000,
        }
      );
    } catch (e) {
      isPrewarmingActive = false;
      console.warn('[Konum Ajanı] GPS ön hazırlığı başlatılamadı:', e);
    }
  },

  stopPrewarming(): void {
    if (locationWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(locationWatchId);
      } catch {}
      locationWatchId = null;
    }
    isPrewarmingActive = false;
  },

  isPrewarming(): boolean {
    return isPrewarmingActive;
  },

  getCachedPosition(maxAgeMs = 45000): GeolocationResult | null {
    if (warmCachedPosition && Date.now() - warmCachedTimestamp <= maxAgeMs) {
      return warmCachedPosition;
    }
    return null;
  },

  /**
   * Milisaniyelik Hızlı Konum Sağlayıcı (0ms Reflex):
   * Eğer arka plan ajanı tarafından ısıtılmış taze konum varsa anında (0ms) döndürür.
   * Yoksa standart çok katmanlı aramayı çalıştırır.
   */
  async getFastOrWarmPosition(options?: PositionOptions, maxAgeMs = 45000): Promise<GeolocationResult> {
    const cached = LocationService.getCachedPosition(maxAgeMs);
    if (cached) {
      return cached;
    }
    return LocationService.getCurrentPosition(options);
  },
};

