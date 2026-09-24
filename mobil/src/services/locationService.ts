import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number | null;
  isMocked?: boolean;
  timestamp?: number;
}

// Son bilinen ve doğrulanmış fiziksel konum (Teleportation / Işınlanma tespiti için)
let lastVerifiedPosition: { latitude: number; longitude: number; timestamp: number } | null = null;

export const LocationService = {
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Cihazın orijinal fiziksel GPS konumunu alır.
   * İkinci parti sahte konum (Mock Location / Fake GPS) yazılımları donanımsal ve işletim sistemi düzeyinde tespit edilerek engellenir.
   */
  async getCurrentPosition(): Promise<GeolocationResult> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Konum izni verilmedi. Lütfen cihaz ayarlarından konum iznini açın.');
    }

    // 1. Cihazın genel konum servisleri açık mı?
    const hasServices = await Location.hasServicesEnabledAsync();
    if (!hasServices) {
      const err: any = new Error('Cihazınızın konum servisleri (GPS) kapalı. Lütfen telefonunuzun ayarlarından konum servisini açın.');
      err.isLocationDisabled = true;
      throw err;
    }

    // 2. Android için Sağlayıcı Durumu Kontrolü
    if (Platform.OS === 'android') {
      try {
        const providerStatus = await Location.getProviderStatusAsync();
        if (!providerStatus.locationServicesEnabled) {
          const err: any = new Error('Cihazınızın konum servisleri kapalı.');
          err.isLocationDisabled = true;
          throw err;
        }
      } catch (e: any) {
        if (e?.isLocationDisabled) throw e;
      }
    }

    // 3. En yüksek donanım doğruluğuyla (GPS uydularından) konumu talep et
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      mayShowUserSettingsDialog: true,
    });

    const { latitude, longitude, accuracy } = pos.coords;
    const now = Date.now();

    // 4. KONTROL 1: Android OS Seviyesi Sahte Konum (Mock Location Provider) Tespiti
    // Android işletim sistemi, geliştirici seçeneklerinden atanan 'Sahte Konum' uygulamalarını 'mocked' olarak bayraklar.
    const isMockedByOS = !!(
      pos.mocked === true ||
      (pos.coords as any)?.mocked === true ||
      (pos as any)?.isFromMockProvider === true
    );

    if (isMockedByOS) {
      const err: any = new Error(
        '🚨 SAHTE KONUM TESPİT EDİLDİ!\n\nCihazınızda ikinci parti bir sahte konum (Mock Location / Fake GPS) uygulaması açık olduğu belirlendi. Güvenlik nedeniyle sisteme yalnızca Android/iOS işletim sisteminin doğrudan GPS uydularından aldığı orijinal konum kabul edilmektedir.\n\nLütfen sahte konum uygulamasını kapatıp telefonun kendi konumunu açın.'
      );
      err.isMockLocation = true;
      throw err;
    }

    // 5. KONTROL 2: Sentetik / Sıfır Sapma (Zero Accuracy) Anomalisi (iOS & Android)
    // Fiziksel bir GPS alıcısı, atmosferik iyonosfer gecikmelerinden dolayı asla tam 0.00000 m sapma veremez.
    // Sahte konum yazılımları sıklıkla 0 veya negatif accuracy değeri enjekte eder.
    if (accuracy !== null && accuracy !== undefined) {
      if (accuracy <= 0.0001) {
        const err: any = new Error(
          '🚨 SAHTE KONUM TESPİT EDİLDİ (Sentetik GPS Sinyali)!\n\nCihazınızdan alınan konum verisi fiziksel GPS uydularından değil, yapay bir simülasyon yazılımından üretilmiş görünüyor. Lütfen sahte konum uygulamalarını kapatın.'
        );
        err.isMockLocation = true;
        throw err;
      }
    }

    // 6. KONTROL 3: Zaman Damgası (Timestamp Freshness) & Replay Koruması
    // Alınan konumun zaman damgası cihazın mevcut saatinden 35 saniyeden daha eskiyse (önceden enjekte edilmiş statik koordinat)
    if (pos.timestamp && Math.abs(now - pos.timestamp) > 35000) {
      const err: any = new Error(
        '🚨 Konum zaman aşımı ve sinyal uyuşmazlığı tespit edildi!\n\nLütfen açık havaya çıkarak gerçek GPS sinyalinin güncellenmesini bekleyin ve tekrar deneyin.'
      );
      err.isMockLocation = true;
      throw err;
    }

    // 7. KONTROL 4: Işınlanma / Aşırı Hızlı Yer Değiştirme (Teleportation Check)
    // Personel son 1 dakika içinde 500 metreden fazla ve 250 km/s üzeri mantıksız bir hızla yer değiştirdiyse (sahte GPS joystick zıplaması)
    if (lastVerifiedPosition) {
      const timeDiffSec = (now - lastVerifiedPosition.timestamp) / 1000;
      if (timeDiffSec > 0 && timeDiffSec < 60) {
        const dist = this.calculateDistance(
          lastVerifiedPosition.latitude,
          lastVerifiedPosition.longitude,
          latitude,
          longitude
        );
        const speedKmh = (dist / timeDiffSec) * 3.6;
        if (dist > 500 && speedKmh > 250) {
          const err: any = new Error(
            '🚨 Şüpheli ani konum değişikliği tespit edildi (Işınlanma engellendi)!\n\nKonumunuz anlık olarak mantıksız bir mesafeye sıçradı. Lütfen sahte konum araçlarını kapatın ve orijinal GPS konumunuzu kullanın.'
          );
          err.isMockLocation = true;
          throw err;
        }
      }
    }

    // Başarılı doğrulama: Son geçerli fiziksel konumu kaydet
    lastVerifiedPosition = {
      latitude,
      longitude,
      timestamp: now,
    };

    let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

    try {
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev && rev.length > 0) {
        const item = rev[0];
        const parts = [
          item.street,
          item.district || item.subregion,
          item.city || item.region,
        ].filter(Boolean);
        if (parts.length > 0) {
          address = parts.join(', ');
        }
      }
    } catch {
      // ignore reverse geocode error
    }

    return { latitude, longitude, address };
  },

  async reverseGeocode(lat: number, lon: number): Promise<string> {
    const fallbackCoord = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    try {
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (rev && rev.length > 0) {
          const item = rev[0];
          const parts = [
            item.street,
            item.district || item.subregion,
            item.city || item.region,
          ].filter(Boolean);
          if (parts.length > 0) {
            return parts.join(', ');
          }
        }
      } catch {
        // Fallback to nominatim
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        { signal: controller.signal, headers: { 'Accept-Language': 'tr' } }
      );
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.address || data.display_name)) {
          const addr = data.address || {};
          const disp = data.display_name || '';
          const dispParts = disp.split(',').map((s: string) => s.trim());

          // 1. Search for official administrative mahalle ending in Mahallesi/Mah./Mh.
          let officialMahalle = '';
          for (let i = 0; i < dispParts.length; i++) {
            if (/(?:mahallesi|mah\.|mh\.)$/i.test(dispParts[i])) {
              officialMahalle = dispParts[i];
              break;
            }
          }

          // 2. Road / Street
          let road = addr.road || addr.pedestrian || addr.street || '';
          if (!road && dispParts.length > 0) {
            const first = dispParts[0];
            if (first && !/(?:mahallesi|mah\.|mh\.|türkiye|erzurum|palandöken|yakutiye)$/i.test(first) && first !== addr.suburb && first !== addr.town && first !== addr.city) {
              road = first;
            }
          }

          // 3. Mahalle (Prefer official administrative Mahalle if present)
          let mahalle = officialMahalle || addr.neighbourhood || addr.suburb || addr.quarter || '';
          if (officialMahalle) {
            mahalle = officialMahalle;
          }
          // Erzurum Palandöken rule: if suburb returned Müftü Solakzade but area is Hüseyin Avni Ulaş
          if (mahalle.indexOf('Müftü Solakzade') !== -1 && disp.indexOf('Hüseyin Avni Ulaş') !== -1) {
            mahalle = 'Hüseyin Avni Ulaş Mahallesi';
          }

          // 4. District / İlçe
          const district = addr.district || addr.town || addr.county || addr.subregion || '';

          // 5. Province / City
          const city = addr.province || addr.city || addr.state || '';

          const parts: string[] = [];
          [road, mahalle, district, city].forEach((p) => {
            if (p && !parts.some((existing) => existing.toLowerCase() === p.toLowerCase())) {
              parts.push(p);
            }
          });

          return parts.length > 0 ? parts.join(', ') : (disp || fallbackCoord);
        }
      }
      return fallbackCoord;
    } catch {
      return fallbackCoord;
    }
  },

  async searchAddress(query: string): Promise<Array<{ latitude: number; longitude: number; displayName: string }>> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&countrycodes=tr&addressdetails=1`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'tr' },
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((item: any) => ({
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name,
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  },

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${meters.toFixed(1)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  },

  isWithinRadius(
    userLat: number,
    userLon: number,
    targetLat: number,
    targetLon: number,
    radiusMeters: number = 20
  ): { isWithin: boolean; distanceMeters: number } {
    const distanceMeters = this.calculateDistance(userLat, userLon, targetLat, targetLon);
    return {
      isWithin: distanceMeters <= radiusMeters,
      distanceMeters,
    };
  },

  openInMaps(address?: string, lat?: number, lon?: number): void {
    let url = '';
    if (lat && lon) {
      if (Platform.OS === 'ios') {
        url = `maps://app?daddr=${lat},${lon}`;
      } else {
        url = `geo:${lat},${lon}?q=${lat},${lon}`;
      }
    } else if (address) {
      const q = encodeURIComponent(address);
      url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
    if (url) {
      Linking.openURL(url).catch(() => {
        if (lat && lon) {
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
        }
      });
    }
  },
};
