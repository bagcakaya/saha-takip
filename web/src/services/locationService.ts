export interface GeolocationResult {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number | null;
  isMocked?: boolean;
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

// Watch position and resolve immediately upon first fix to wake up mobile GPS sensor
function watchFirstPosition(options: PositionOptions, timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let timer: any = null;

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
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error('WATCH_TIMEOUT'));
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          cleanup();
          resolve(pos);
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
   * Çok Katmanlı (Multi-Tier) Eşzamanlı Anında Algılama Mimarisi:
   * 1. Hızlı Önbellek / Hücresel / Wi-Fi Konumu ile Yüksek Hassasiyetli GPS Eşzamanlı (Parallel) Başlatılır.
   * 2. GPS anında yanıt verirse (<1.5s) donanım uydu hassasiyeti seçilir.
   * 3. Depo, bodrum, kapalı alanda GPS gecikirse (<2.5s) ağ/hücresel konum anında devreye sokulur.
   * 4. Son doğrulanmış konum tamponu ve net hata yönetimi (Konum açıkken asla "kapalı" demez).
   */
  async getCurrentPosition(options?: PositionOptions): Promise<GeolocationResult> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const err: any = new Error('Cihazınız veya tarayıcınız konum servislerini desteklemiyor.');
      err.isLocationDisabled = true;
      throw err;
    }

    let position: GeolocationPosition | null = null;
    let lastError: any = null;

    // Paralel Başlatma:
    // A. Hızlı Ağ / Önbellek Konumu (Wi-Fi, Hücresel, OS Önbelleği)
    const fastPromise = queryPosition({
      enableHighAccuracy: false,
      timeout: 3000,
      maximumAge: 180000,
    }).catch((err) => {
      if (err?.code === 1) throw err;
      return null;
    });

    // B. Yüksek Hassasiyetli GPS Alıcısı (Uydu Kilidi)
    const gpsPromise = watchFirstPosition(
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000,
        ...options,
      },
      6000
    ).catch((err) => {
      if (err?.code === 1) throw err;
      lastError = err;
      return null;
    });

    try {
      // Önce hızlı gelen adayı kontrol et
      const fastResult = await Promise.race([
        fastPromise,
        new Promise<null>((res) => setTimeout(() => res(null), 1200)),
      ]);

      if (fastResult && fastResult.coords.accuracy !== null && fastResult.coords.accuracy <= 35) {
        // Hızlı konum çok net (<= 35m), hemen kabul et!
        position = fastResult;
      } else {
        // GPS uydusunu bekle veya hızlı adayı tamponla
        const gpsResult = await Promise.race([
          gpsPromise,
          new Promise<null>((res) => setTimeout(() => res(null), 2500)),
        ]);

        if (gpsResult) {
          position = gpsResult;
        } else {
          // GPS 2.5 saniyede kilitlenemediyse (depo/iç mekan), hızlı adayı kontrol et
          const fullFast = await fastPromise;
          if (fullFast) {
            position = fullFast;
          } else {
            // Son çare GPS'in kalan 3.5 saniyesini bekle
            position = await gpsPromise;
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

    return {
      latitude,
      longitude,
      accuracy,
      address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    };
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

