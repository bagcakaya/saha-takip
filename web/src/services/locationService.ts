export interface GeolocationResult {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface AddressSearchResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export const LocationService = {
  /**
   * Retrieves user's current GPS position via browser Geolocation API
   */
  async getCurrentPosition(options?: PositionOptions): Promise<GeolocationResult> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const err: any = new Error('Cihazınız veya tarayıcınız konum servislerini desteklemiyor.');
      err.isLocationDisabled = true;
      throw err;
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let address = '';
          try {
            address = await LocationService.reverseGeocode(latitude, longitude);
          } catch (e) {
            console.warn('Reverse geocoding failed:', e);
            address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          }

          resolve({
            latitude,
            longitude,
            address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          });
        },
        (error) => {
          let msg = 'Konum servisleri kapalı veya konum bilgisi alınamadı.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Konum izni verilmedi veya kapalı. İşe giriş ve çıkış yapabilmek için lütfen tarayıcı ve cihaz ayarlarından konum servislerini açın.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'Cihazınızın konum servisleri (GPS) kapalı. İşe giriş ve çıkış yapabilmek için lütfen cihazınızın konum servisini açın.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'Konum bilgisi alınamadı (Zaman aşımı). Lütfen konum servislerinizin açık ve GPS sinyalinin aktif olduğundan emin olun.';
          }
          const customError: any = new Error(msg);
          customError.code = error.code;
          customError.isLocationDisabled = true;
          reject(customError);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          ...options,
        }
      );
    });
  },

  /**
   * Reverse geocodes coordinates to street address using OpenStreetMap Nominatim
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'tr',
          },
        }
      );
      if (!response.ok) {
        throw new Error('Geocoding servisine ulaşılamadı');
      }
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.street || '';
        const suburb = addr.neighbourhood || addr.suburb || addr.quarter || '';
        const district = addr.district || addr.town || addr.county || '';
        const city = addr.city || addr.province || addr.state || '';

        const parts = [road, suburb, district, city].filter(Boolean);
        if (parts.length > 0) {
          return parts.join(', ');
        }
        return data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
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
};

