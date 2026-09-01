import { TimeOfDay, WeatherCondition, WeatherData } from '../types/auth';

export const WeatherService = {
  /**
   * Calculates time of day based on current hour
   */
  getTimeOfDay(): TimeOfDay {
    const hour = new Date().getHours();
    if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 20)) {
      return 'sunset';
    }
    if (hour >= 8 && hour < 18) {
      return 'day';
    }
    return 'night';
  },

  /**
   * Automatically detects user's city and coordinates
   * In local development -> defaults to Erzurum
   * In live production -> automatically detects user's actual city via GPS & IP
   */
  async detectLocation(): Promise<{ lat: number; lon: number; city: string }> {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '');

    // 1. Try Browser GPS first if permission is granted
    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const gpsPos: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 2500,
            maximumAge: 600000,
          });
        });
        const lat = gpsPos.coords.latitude;
        const lon = gpsPos.coords.longitude;

        // Try reverse geocoding for city name
        try {
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
            { signal: AbortSignal.timeout(2000) }
          );
          if (revRes.ok) {
            const revData = await revRes.json();
            const cityName =
              revData.address?.province ||
              revData.address?.city ||
              revData.address?.state ||
              revData.address?.county ||
              'Konumunuz';
            return { lat, lon, city: cityName };
          }
        } catch {
          // ignore reverse geocode error
        }

        return { lat, lon, city: isLocalhost ? 'Erzurum' : 'Konumunuz' };
      }
    } catch {
      // GPS not available or not permitted
    }

    // 2. If in local development, use Erzurum
    if (isLocalhost) {
      return {
        lat: 39.9055,
        lon: 41.2658,
        city: 'Erzurum',
      };
    }

    // 3. In live production, detect via IP Geolocation
    try {
      const res = await fetch('https://ipwho.is/', {
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success !== false && data.latitude && data.longitude) {
          return {
            lat: data.latitude,
            lon: data.longitude,
            city: data.city || data.region || 'Bulunduğunuz Konum',
          };
        }
      }
    } catch {
      // ignore
    }

    // 4. Fallback for Turkey
    return {
      lat: 39.9055,
      lon: 41.2658,
      city: 'Erzurum',
    };
  },

  /**
   * Fetches current live weather from Open-Meteo API using auto-detected location
   */
  async getCurrentWeather(): Promise<WeatherData> {
    const timeOfDay = this.getTimeOfDay();

    // Automatically detect user's city & coordinates
    const { lat, lon, city } = await this.detectLocation();

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!res.ok) throw new Error('Hava durumu alınamadı');

      const data = await res.json();
      const current = data.current;
      const weatherCode = current?.weather_code ?? 0;
      const isDay = current?.is_day === 1;
      const temp = Math.round(current?.temperature_2m ?? 22);

      let condition: WeatherCondition = 'clear';
      let weatherText = isDay ? 'Açık Güneşli' : 'Berrak Gece';

      if (weatherCode === 0) {
        condition = 'clear';
        weatherText = isDay ? 'Açık Güneşli' : 'Berrak Gece';
      } else if (weatherCode >= 1 && weatherCode <= 2) {
        condition = 'partly_cloudy';
        weatherText = isDay ? 'Parçalı Bulutlu' : 'Parçalı Bulutlu Gece';
      } else if (weatherCode === 3 || weatherCode === 45 || weatherCode === 48) {
        condition = 'cloudy';
        weatherText = 'Bulutlu / Kapalı';
      } else if (
        (weatherCode >= 51 && weatherCode <= 67) ||
        (weatherCode >= 80 && weatherCode <= 82)
      ) {
        condition = 'rain';
        weatherText = 'Yağışlı / Yağmurlu';
      } else if (
        (weatherCode >= 71 && weatherCode <= 77) ||
        (weatherCode >= 85 && weatherCode <= 86)
      ) {
        condition = 'snow';
        weatherText = 'Kar Yağışlı';
      } else if (weatherCode >= 95) {
        condition = 'thunderstorm';
        weatherText = 'Gök Gürültülü Fırtına';
      }

      return {
        timeOfDay: isDay ? (timeOfDay === 'sunset' ? 'sunset' : 'day') : 'night',
        condition,
        temperature: temp,
        weatherText,
        locationName: city,
        isDay,
      };
    } catch {
      // Offline fallback
      const isDaytime = timeOfDay === 'day' || timeOfDay === 'sunset';
      return {
        timeOfDay,
        condition: 'clear',
        temperature: isDaytime ? 24 : 18,
        weatherText:
          timeOfDay === 'night'
            ? 'Yıldızlı Gece'
            : timeOfDay === 'sunset'
            ? 'Günbatımı'
            : 'Güneşli Gökyüzü',
        locationName: city || 'Erzurum',
        isDay: isDaytime,
      };
    }
  },
};
