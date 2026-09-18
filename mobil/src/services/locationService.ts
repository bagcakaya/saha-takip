import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  address?: string;
}

export const LocationService = {
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  async getCurrentPosition(): Promise<GeolocationResult> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Konum izni verilmedi. Lütfen cihaz ayarlarından konum iznini açın.');
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude, longitude } = pos.coords;
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
