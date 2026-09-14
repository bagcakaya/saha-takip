export interface GeolocationResult {
  latitude: number;
  longitude: number;
  address?: string;
}

export const LocationService = {
  /**
   * Retrieves user's current GPS position via browser Geolocation API
   */
  async getCurrentPosition(): Promise<GeolocationResult> {
    if (!navigator.geolocation) {
      throw new Error('Tarayıcınız konum servislerini desteklemiyor.');
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
          let msg = 'Konum alınamadı.';
          if (error.code === error.PERMISSION_DENIED) {
            msg = 'Konum izni verilmedi. Lütfen tarayıcı ayarlarından konum erişimine izin verin.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = 'Konum bilgisi şu anda kullanılamıyor. GPS veya ağ bağlantınızı kontrol edin.';
          } else if (error.code === error.TIMEOUT) {
            msg = 'Konum alma isteği zaman aşımına uğradı.';
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
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
};

