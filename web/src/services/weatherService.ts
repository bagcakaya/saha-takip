import { TimeOfDay, WeatherCondition, WeatherData } from '../types/auth';

export interface LocationCoords {
  lat: number;
  lon: number;
  city: string;
}

const DEFAULT_LOCATION: LocationCoords = {
  lat: 39.9055,
  lon: 41.2658,
  city: 'Erzurum',
};

const LAST_GPS_KEY = '@saha_takip_last_gps_location';
const CACHED_WEATHER_KEY = '@saha_takip_cached_weather';

/**
 * Checks if the given coordinates fall within the geographical boundary of Erzurum province
 */
function isWithinErzurum(lat: number, lon: number): boolean {
  return lat >= 39.15 && lat <= 40.75 && lon >= 40.20 && lon <= 42.60;
}

/**
 * Resolves a friendly Turkish city name from GPS coordinates
 */
async function reverseGeocodeCity(lat: number, lon: number): Promise<string> {
  // If coordinates are inside Erzurum, immediately return Erzurum with 0 network latency
  if (isWithinErzurum(lat, lon)) {
    return 'Erzurum';
  }

  // 1. Fast & reliable client-side reverse geocoding via BigDataCloud
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) {
      const data = await res.json();
      const detectedCity =
        data.city ||
        data.principalSubdivision ||
        data.locality ||
        data.countryName;
      if (detectedCity && detectedCity !== 'Türkiye') {
        return detectedCity.replace(' İli', '').trim();
      }
    }
  } catch {
    // fallback
  }

  // 2. OpenStreetMap Nominatim with Turkish language fallback
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&accept-language=tr`,
      {
        signal: AbortSignal.timeout(3000),
        headers: { 'Accept-Language': 'tr' },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address;
      const cityName =
        addr?.province ||
        addr?.city ||
        addr?.state ||
        addr?.town ||
        addr?.district;
      if (cityName) {
        return cityName.replace(' İli', '').trim();
      }
    }
  } catch {
    // fallback
  }

  return 'Erzurum';
}

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
   * Retrieves the last known GPS location from localStorage or returns Erzurum default
   */
  getLastKnownLocation(): LocationCoords {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LAST_GPS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed.lat === 'number' &&
            typeof parsed.lon === 'number' &&
            parsed.city
          ) {
            return {
              lat: parsed.lat,
              lon: parsed.lon,
              city: parsed.city,
            };
          }
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_LOCATION;
  },

  /**
   * Saves a verified GPS location to localStorage
   */
  saveLastKnownLocation(location: LocationCoords): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          LAST_GPS_KEY,
          JSON.stringify({
            ...location,
            timestamp: Date.now(),
          })
        );
      } catch {
        // ignore
      }
    }
  },

  /**
   * Retrieves cached weather data for instant UI rendering
   */
  getCachedWeather(): WeatherData | null {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CACHED_WEATHER_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.locationName && typeof parsed.temperature === 'number') {
            return parsed as WeatherData;
          }
        }
      } catch {
        // ignore
      }
    }
    return null;
  },

  /**
   * Persists weather data to cache
   */
  saveCachedWeather(weather: WeatherData): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CACHED_WEATHER_KEY, JSON.stringify(weather));
      } catch {
        // ignore
      }
    }
  },

  /**
   * Automatically detects user's city and coordinates via device GPS.
   * If GPS is unavailable, uses previously cached location or Erzurum default.
   * (Does NOT use cellular IP geolocation, which falsely returns Ankara/Istanbul in Turkey).
   */
  async detectLocation(forceRefresh = false): Promise<LocationCoords> {
    const lastKnown = this.getLastKnownLocation();

    // 1. Try Browser GPS
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const gpsPos: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: forceRefresh ? 0 : 300000, // 5 min cache
          });
        });

        const lat = gpsPos.coords.latitude;
        const lon = gpsPos.coords.longitude;
        const city = await reverseGeocodeCity(lat, lon);

        const detected: LocationCoords = { lat, lon, city };
        this.saveLastKnownLocation(detected);
        return detected;
      } catch (err) {
        // GPS not permitted, timed out, or unavailable
      }
    }

    // 2. Safe Fallback: Last known verified location or Erzurum default
    return lastKnown;
  },

  /**
   * Fetches current live weather from Open-Meteo API using auto-detected GPS location
   */
  async getCurrentWeather(forceRefresh = false): Promise<WeatherData> {
    const timeOfDay = this.getTimeOfDay();

    // Automatically detect user's city & coordinates
    const { lat, lon, city } = await this.detectLocation(forceRefresh);

    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!res.ok) throw new Error('Hava durumu verisi alınamadı');

      const data = await res.json();
      const current = data.current;
      const weatherCode = current?.weather_code ?? 0;
      const isDay = current?.is_day === 1;
      const temp = Math.round(current?.temperature_2m ?? 20);

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

      const weatherResult: WeatherData = {
        timeOfDay: isDay ? (timeOfDay === 'sunset' ? 'sunset' : 'day') : 'night',
        condition,
        temperature: temp,
        weatherText,
        locationName: city,
        isDay,
      };

      this.saveCachedWeather(weatherResult);
      return weatherResult;
    } catch {
      // Offline fallback
      const cached = this.getCachedWeather();
      if (cached) return cached;

      const isDaytime = timeOfDay === 'day' || timeOfDay === 'sunset';
      return {
        timeOfDay,
        condition: 'clear',
        temperature: isDaytime ? 22 : 16,
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
