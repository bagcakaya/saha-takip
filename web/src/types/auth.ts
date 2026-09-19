export type UserRole = 'admin' | 'staff';

export type LicenseType =
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'custom'
  | 'lifetime';

export type LicenseStatus = 'active' | 'expiring_soon' | 'expired' | 'suspended';

export interface Company {
  id: number;
  code: string; // e.g. 'POLATLAR', 'AKARSU' (always uppercase)
  name: string; // e.g. 'Polatlar', 'Akarsu Teknik'
  adminEmail: string;
  adminName: string;
  createdAt: number;
  licenseType?: LicenseType;
  licenseExpiresAt?: number; // timestamp in ms (0 or undefined = lifetime/sınırsız)
  isFrozen?: boolean; // manual freeze/suspend by super admin
  freezeReason?: string;
  maxBranches?: number;
  maxUsers?: number;
  notes?: string;
}

export interface LicenseInfo {
  active: boolean;
  status: LicenseStatus;
  remainingDays: number;
  isLifetime: boolean;
  expiresDateFormatted?: string;
  message: string;
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
  branchId?: string;
  branchName?: string;
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
  branchId?: string;
  branchName?: string;
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

/**
 * Checks if a user is permitted to create/add/delete branches.
 * Strictly restricted to POLATLAR company managers with username 'admin' or 'murat'.
 * Managers of other companies can only view their branches.
 */
export function canUserAddBranch(
  user: { role?: string; companyCode?: string; username?: string } | null | undefined
): boolean {
  if (!user) return false;
  const comp = (user.companyCode || 'POLATLAR').trim().toUpperCase();
  const uname = (user.username || '').trim().toLowerCase();
  const isAdmin = isUserAdmin(user);
  return comp === 'POLATLAR' && isAdmin && (uname === 'admin' || uname === 'murat');
}

/**
 * Checks if a user is permitted to configure server connection (SQL Server / Cloud).
 * Strictly restricted to POLATLAR administrators ('admin' or 'murat').
 */
export function canUserManageServerConfig(
  user: { role?: string; companyCode?: string; username?: string } | null | undefined
): boolean {
  if (!user) return false;
  const comp = (user.companyCode || 'POLATLAR').trim().toUpperCase();
  const uname = (user.username || '').trim().toLowerCase();
  const isAdmin = isUserAdmin(user);
  return comp === 'POLATLAR' && isAdmin && (uname === 'admin' || uname === 'murat');
}

/**
 * Master company (POLATLAR) is permanently exempt from license expiration or freezing.
 */
export function isCompanyExempt(companyCode?: string): boolean {
  return (companyCode || '').trim().toUpperCase() === 'POLATLAR';
}

/**
 * Calculates current license status, remaining days, and validity for a company.
 */
export function getCompanyLicenseInfo(company?: Company | null): LicenseInfo {
  if (!company) {
    return {
      active: true,
      status: 'active',
      remainingDays: 9999,
      isLifetime: true,
      message: 'Aktif',
    };
  }

  // POLATLAR is the root master company and is ALWAYS exempt from freeze and expiration
  if (isCompanyExempt(company.code)) {
    return {
      active: true,
      status: 'active',
      remainingDays: 9999,
      isLifetime: true,
      message: 'Ömür Boyu (Ana Sistem)',
    };
  }

  // Manual Freeze / Suspension
  if (company.isFrozen) {
    return {
      active: false,
      status: 'suspended',
      remainingDays: 0,
      isLifetime: false,
      message: company.freezeReason || 'Hizmet geçici olarak dondurulmuştur.',
    };
  }

  // Lifetime license
  if (company.licenseType === 'lifetime' || !company.licenseExpiresAt || company.licenseExpiresAt === 0) {
    return {
      active: true,
      status: 'active',
      remainingDays: 9999,
      isLifetime: true,
      message: 'Sınırsız / Ömür Boyu',
    };
  }

  const now = Date.now();
  const diffMs = company.licenseExpiresAt - now;
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const expDate = new Date(company.licenseExpiresAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (remainingDays <= 0) {
    return {
      active: false,
      status: 'expired',
      remainingDays: 0,
      isLifetime: false,
      expiresDateFormatted: expDate,
      message: `Lisans süresi doldu (${expDate})`,
    };
  }

  if (remainingDays <= 7) {
    return {
      active: true,
      status: 'expiring_soon',
      remainingDays,
      isLifetime: false,
      expiresDateFormatted: expDate,
      message: `${remainingDays} gün kaldı (Son gün: ${expDate})`,
    };
  }

  return {
    active: true,
    status: 'active',
    remainingDays,
    isLifetime: false,
    expiresDateFormatted: expDate,
    message: `${remainingDays} gün kaldı (${expDate})`,
  };
}

/**
 * Checks if a user is permitted to manage SaaS institution licenses, extensions, and freezing.
 * Strictly restricted to POLATLAR administrators with username 'admin' or 'murat'.
 */
export function canUserManageLicenses(
  user: { role?: string; companyCode?: string; username?: string } | null | undefined
): boolean {
  if (!user) return false;
  const comp = (user.companyCode || 'POLATLAR').trim().toUpperCase();
  const uname = (user.username || '').trim().toLowerCase();
  const isAdmin = isUserAdmin(user);
  return comp === 'POLATLAR' && isAdmin && (uname === 'admin' || uname === 'murat');
}

/**
 * Checks if a user is permitted to view and manage Institutions and Branches ("Kurum ve Şubeler").
 * Strictly restricted to POLATLAR company administrators with username 'admin' or 'murat'.
 * Managers and users of other companies cannot see or access this section.
 */
export function canUserManageInstitutionsAndBranches(
  user: { role?: string; companyCode?: string; username?: string } | null | undefined
): boolean {
  if (!user) return false;
  const comp = (user.companyCode || 'POLATLAR').trim().toUpperCase();
  const uname = (user.username || '').trim().toLowerCase();
  const isAdmin = isUserAdmin(user);
  return comp === 'POLATLAR' && isAdmin && (uname === 'admin' || uname === 'murat');
}



