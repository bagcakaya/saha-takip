export type UserRole = 'admin' | 'staff';

export interface Company {
  id: number;
  code: string; // e.g. 'POLATLAR', 'AKARSU' (always uppercase)
  name: string; // e.g. 'Polatlar', 'Akarsu Teknik'
  adminEmail: string;
  adminName: string;
  createdAt: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  createdAt: number;
  companyCode: string; // e.g. 'POLATLAR'
  companyName?: string;
  email?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  createdAt: number;
  companyCode: string; // e.g. 'POLATLAR'
  companyName?: string;
  email?: string;
}

export type TimeOfDay = 'day' | 'night' | 'sunset';

export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

export interface WeatherData {
  timeOfDay: TimeOfDay;
  condition: WeatherCondition;
  temperature: number;
  weatherText: string;
  locationName: string;
  isDay: boolean;
}

/**
 * Checks if a user is an administrator.
 * In POLATLAR company, both 'admin' and 'murat' have full administrator privileges.
 */
export function isUserAdmin(
  user: { role?: string; companyCode?: string; username?: string } | null | undefined
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const comp = (user.companyCode || 'POLATLAR').toUpperCase();
  const uname = (user.username || '').toLowerCase();
  if (comp === 'POLATLAR' && (uname === 'admin' || uname === 'murat')) {
    return true;
  }
  return false;
}
