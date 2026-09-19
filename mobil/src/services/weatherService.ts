import * as Location from 'expo-location';

export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export interface MobileWeatherData {
  condition: WeatherCondition;
  temperature: number;
  weatherText: string;
  locationName: string;
  isDay: boolean;
  timeOfDay: 'day' | 'night' | 'sunset';
}

export const WeatherService = {
  getTimeOfDay(): 'day' | 'night' | 'sunset' {
    const hour = new Date().getHours();
    if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 20)) {
      return 'sunset';
    }
    if (hour >= 8 && hour < 18) {
      return 'day';
    }
    return 'night';
  },

  async getCurrentWeather(): Promise<MobileWeatherData> {
    const timeOfDay = this.getTimeOfDay();
    let lat = 39.9055;
    let lon = 41.2658;
    let city = 'Erzurum';

    // Try GPS
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;

        if (lat >= 39.15 && lat <= 40.75 && lon >= 40.20 && lon <= 42.60) {
          city = 'Erzurum';
        } else {
          try {
            const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
            if (rev && rev.length > 0) {
              city = rev[0].city || rev[0].subregion || rev[0].region || 'Konumunuz';
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const current = data.current;
        const code = current?.weather_code ?? 0;
        const isDay = current?.is_day === 1;
        const temp = Math.round(current?.temperature_2m ?? 20);

        let condition: WeatherCondition = 'clear';
        let weatherText = isDay ? 'Açık Güneşli' : 'Yıldızlı Gece';

        if (code === 0) {
          condition = 'clear';
          weatherText = isDay ? 'Açık Güneşli' : 'Yıldızlı Gece';
        } else if (code >= 1 && code <= 2) {
          condition = 'partly_cloudy';
          weatherText = isDay ? 'Parçalı Bulutlu' : 'Parçalı Bulutlu';
        } else if (code === 3 || code === 45 || code === 48) {
          condition = 'cloudy';
          weatherText = 'Bulutlu';
        } else if (
          (code >= 51 && code <= 67) ||
          (code >= 80 && code <= 82)
        ) {
          condition = 'rain';
          weatherText = 'Yağmurlu';
        } else if (
          (code >= 71 && code <= 77) ||
          (code >= 85 && code <= 86)
        ) {
          condition = 'snow';
          weatherText = 'Kar Yağışlı';
        } else if (code >= 95) {
          condition = 'thunderstorm';
          weatherText = 'Fırtına';
        }

        return {
          condition,
          temperature: temp,
          weatherText,
          locationName: city,
          isDay,
          timeOfDay: isDay ? (timeOfDay === 'sunset' ? 'sunset' : 'day') : 'night',
        };
      }
    } catch {
      // offline fallback
    }

    const isDaytime = timeOfDay === 'day' || timeOfDay === 'sunset';
    return {
      condition: 'clear',
      temperature: isDaytime ? 22 : 16,
      weatherText: isDaytime ? 'Güneşli' : 'Yıldızlı Gece',
      locationName: city,
      isDay: isDaytime,
      timeOfDay,
    };
  },
};
