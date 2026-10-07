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
  modulePermissions?: CompanyModulePermissions;
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
  phone?: string;
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
  phone?: string;
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

/**
 * Module permission configuration for a single role
 */
export interface ModulePermissionConfig {
  staff: boolean;
  admin: boolean;
  subModules?: {
    [subModuleId: string]: {
      staff: boolean;
      admin: boolean;
    };
  };
}

/**
 * Company-wide module permissions mapping: [moduleId] -> { staff: boolean, admin: boolean, subModules?: ... }
 */
export type CompanyModulePermissions = {
  [moduleId: string]: ModulePermissionConfig;
};

export interface AppSubModule {
  id: string;
  name: string;
  shortTitle?: string;
  description?: string;
  defaultStaff: boolean;
  defaultAdmin: boolean;
}

export interface AppFeatureModule {
  id: string;
  name: string;
  shortTitle: string;
  description: string;
  defaultStaff: boolean;
  defaultAdmin: boolean;
  category: 'core' | 'operations' | 'technical' | 'management';
  subModules?: AppSubModule[];
}

/**
 * Standard system modules that can be toggled per company & role by POLATLAR Super Admins
 */
export const APP_FEATURE_MODULES: AppFeatureModule[] = [
  {
    id: 'staff_tracking',
    name: 'Personel Takibi',
    shortTitle: 'Giriş / Çıkış & İzin',
    description: 'Konum doğrulamalı işe giriş-çıkış, mola, izin talepleri ve canlı mesai takibi',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'core',
    subModules: [
      {
        id: 'checkin_checkout',
        name: 'İşe Giriş / Çıkış',
        shortTitle: 'Giriş / Çıkış',
        description: 'GPS konum doğrulamalı anlık işe geliş ve çıkış kayıtları',
        defaultStaff: true,
        defaultAdmin: true,
      },
      {
        id: 'breaks',
        name: 'Mola Yönetimi',
        shortTitle: 'Mola',
        description: 'Canlı mola sayacı, mola bildirimleri ve günlük mola takibi',
        defaultStaff: true,
        defaultAdmin: true,
      },
      {
        id: 'summary',
        name: 'Mesai Özeti & Tablo',
        shortTitle: 'Mesai Özeti',
        description: 'Çalışma geçmişi, tarih filtreleri, Excel/PDF mesai raporları',
        defaultStaff: false,
        defaultAdmin: true,
      },
      {
        id: 'leaves',
        name: 'İzin Takibi',
        shortTitle: 'İzinler',
        description: 'Saatlik ve günlük izin talepleri ve yönetici onayları',
        defaultStaff: true,
        defaultAdmin: true,
      },
      {
        id: 'shifts',
        name: 'Vardiya',
        shortTitle: 'Vardiya',
        description: 'Personel vardiya atamaları ve haftalık çalışma programı',
        defaultStaff: true,
        defaultAdmin: true,
      },
      {
        id: 'salary',
        name: 'Maaş & Ödeme Takibi',
        shortTitle: 'Maaş & Bordro',
        description: 'Personel maaş ve avans ödemeleri, nakit/banka dökümü ve ay bazında arşiv',
        defaultStaff: false,
        defaultAdmin: true,
      },
      {
        id: 'workplace',
        name: 'Merkez İş Yeri & Şubeler',
        shortTitle: 'Lokasyonlar',
        description: '20 metre toleranslı merkez GPS ve şube konum koordinatları',
        defaultStaff: false,
        defaultAdmin: true,
      },
      {
        id: 'definitions',
        name: 'Tanımlamalar',
        shortTitle: 'Tanımlar & Ayarlar',
        description: 'Vardiya şablonları ve şube mola süreleri yapılandırması',
        defaultStaff: false,
        defaultAdmin: true,
      },
    ],
  },
  {
    id: 'notes',
    name: 'İş Emirleri',
    shortTitle: 'İş Takip',
    description: 'Personele görev atama, görsel yaşlandırma renkleri, alarmlar ve iş onayları',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'operations',
  },
  {
    id: 'timed_follow_ups',
    name: 'Süreli Takipler',
    shortTitle: 'Süreli Takip',
    description: 'Cari bazlı randevu, ödeme ve zaman ayarlı iş hatırlatıcıları',
    defaultStaff: false,
    defaultAdmin: true,
    category: 'operations',
  },
  {
    id: 'personal_notes',
    name: 'Kişisel Notlarım',
    shortTitle: 'Notlarım',
    description: 'Kullanıcıya özel not defteri ve doğrudan düzenlenebilir kişisel notlar',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'core',
  },
  {
    id: 'reminders',
    name: 'Yönetici Hatırlatmaları',
    shortTitle: 'Hatırlatma',
    description: 'Yönetici çalışma kuralları, talimatları ve genel duyurular',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'core',
  },
  {
    id: 'installations',
    name: 'Kurulumlar',
    shortTitle: 'Kurulumlar',
    description: 'Müşteri kurulumları, saha montajları, adresler ve kontrol listeleri',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'technical',
  },
  {
    id: 'services',
    name: 'Servisler',
    shortTitle: 'Servisler',
    description: 'Teknik servis müdahaleleri, parça ve yapılan iş kayıtları',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'technical',
  },
  {
    id: 'returns',
    name: 'İade / Garanti',
    shortTitle: 'İade & Garanti',
    description: 'Seri no, kargo fişi ve 1 haftalık otomatik süreç takibi',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'technical',
  },
  {
    id: 'logs',
    name: 'Log & Güvenlik Kayıtları',
    shortTitle: 'Log Kayıtları',
    description: 'Cihaz uyuşmazlığı, yetkisiz giriş denemeleri ve kilitlenme logları',
    defaultStaff: false,
    defaultAdmin: true,
    category: 'management',
  },
  {
    id: 'template',
    name: 'Şablonlar',
    shortTitle: 'Şablonlar',
    description: 'Standart kontrol listesi görevleri ve tam veri seti yönetimi',
    defaultStaff: true,
    defaultAdmin: true,
    category: 'management',
  },
  {
    id: 'job_applications',
    name: 'İş Başvuruları',
    shortTitle: 'İş Başvurusu',
    description: 'Aday kayıtları, CV, mülakat aşamaları ve personel dönüşümü',
    defaultStaff: false,
    defaultAdmin: true,
    category: 'management',
  },
];

/**
 * Checks if a user is permitted to configure company module permissions.
 * Strictly restricted to POLATLAR super administrators ('admin' or 'murat').
 */
export function canUserManageCompanyModules(
  user: { role?: string; companyCode?: string; username?: string } | null | undefined
): boolean {
  if (!user) return false;
  const comp = (user.companyCode || 'POLATLAR').trim().toUpperCase();
  const uname = (user.username || '').trim().toLowerCase();
  const isAdmin = isUserAdmin(user);
  return comp === 'POLATLAR' && isAdmin && (uname === 'admin' || uname === 'murat');
}

/**
 * Checks whether a module is permitted for the given user in their company.
 * - POLATLAR company always has all modules visible.
 * - Other companies respect company.modulePermissions configured by POLATLAR super admins.
 */
export function isModulePermitted(
  moduleId: string,
  user: { role?: string; companyCode?: string; username?: string } | null | undefined,
  company?: Company | null
): boolean {
  if (!user) return false;
  const targetCompCode = (company?.code || user.companyCode || 'POLATLAR').trim().toUpperCase();
  const isAdmin = isUserAdmin(user);
  const role: 'admin' | 'staff' = isAdmin ? 'admin' : 'staff';

  // POLATLAR always has all modules visible when viewing POLATLAR
  if (targetCompCode === 'POLATLAR') {
    if (isAdmin) return true;
    const def = APP_FEATURE_MODULES.find((m) => m.id === moduleId);
    if (def) {
      return def.defaultStaff;
    }
    return true;
  }

  // If company has specific module permissions defined:
  if (company?.modulePermissions && company.modulePermissions[moduleId]) {
    const config = company.modulePermissions[moduleId];
    return role === 'admin' ? Boolean(config.admin) : Boolean(config.staff);
  }

  // Default permissions if not yet customized for this company:
  const def = APP_FEATURE_MODULES.find((m) => m.id === moduleId);
  if (def) {
    return role === 'admin' ? def.defaultAdmin : def.defaultStaff;
  }

  return true;
}

/**
 * Checks whether a specific sub-module / section is permitted for the given user in their company.
 * - Parent module must be permitted first.
 * - In POLATLAR company, admins have full access; staff follow default or configured permissions.
 * - Respects company custom module subModules permissions if configured.
 * - Falls back to default permission if not configured.
 */
export function isSubModulePermitted(
  moduleId: string,
  subModuleId: string,
  user: { role?: string; companyCode?: string; username?: string } | null | undefined,
  company?: Company | null
): boolean {
  if (!user) return false;

  // 1. Parent module check - if parent is disabled, sub-modules are disabled
  if (!isModulePermitted(moduleId, user, company)) {
    return false;
  }

  const targetCompCode = (company?.code || user.companyCode || 'POLATLAR').trim().toUpperCase();
  const isAdmin = isUserAdmin(user);
  const role: 'admin' | 'staff' = isAdmin ? 'admin' : 'staff';

  const modDef = APP_FEATURE_MODULES.find((m) => m.id === moduleId);
  const subDef = modDef?.subModules?.find((s) => s.id === subModuleId);

  // In POLATLAR company:
  if (targetCompCode === 'POLATLAR') {
    if (isAdmin) return true;
    if (subDef) return subDef.defaultStaff;
    return true;
  }

  // Check company custom permissions
  const companyPerm = company?.modulePermissions?.[moduleId];
  if (companyPerm?.subModules && companyPerm.subModules[subModuleId]) {
    const subConfig = companyPerm.subModules[subModuleId];
    return role === 'admin' ? Boolean(subConfig.admin) : Boolean(subConfig.staff);
  }

  // Fallback to module definition defaults
  if (subDef) {
    return role === 'admin' ? subDef.defaultAdmin : subDef.defaultStaff;
  }

  return true;
}
