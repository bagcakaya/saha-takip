import { TabType } from '../components/layout/Header';

export const VALID_TABS: TabType[] = [
  'home',
  'branches',
  'installations',
  'services',
  'notes',
  'staff_tracking',
  'timed_follow_ups',
  'reminders',
  'returns',
  'logs',
  'template',
];

/**
 * Normalizes any tab identifier string (e.g. 'timed-follow-ups', 'timedfollowups', 'sureli_takip', 'staff-tracking')
 * into the canonical TabType enum.
 */
export function normalizeTab(rawTab?: string | null): TabType | null {
  if (!rawTab) return null;
  const clean = String(rawTab).trim().toLowerCase().replace(/-/g, '_');

  const aliases: Record<string, TabType> = {
    home: 'home',
    dashboard: 'home',
    anasayfa: 'home',

    installations: 'installations',
    kurulumlar: 'installations',
    montaj: 'installations',

    services: 'services',
    servisler: 'services',
    ariza: 'services',
    bakim: 'services',

    notes: 'notes',
    notlar: 'notes',
    is_emirleri: 'notes',
    is_emri: 'notes',

    staff_tracking: 'staff_tracking',
    stafftracking: 'staff_tracking',
    personel: 'staff_tracking',
    personel_takibi: 'staff_tracking',
    takip: 'staff_tracking',
    izin: 'staff_tracking',
    izinler: 'staff_tracking',
    izin_talepleri: 'staff_tracking',

    timed_follow_ups: 'timed_follow_ups',
    timedfollowups: 'timed_follow_ups',
    sureli_takip: 'timed_follow_ups',
    surelitakip: 'timed_follow_ups',
    alarm: 'timed_follow_ups',
    alarmlar: 'timed_follow_ups',
    cari_takip: 'timed_follow_ups',

    reminders: 'reminders',
    admin_reminders: 'reminders',
    adminreminders: 'reminders',
    hatirlaticilar: 'reminders',

    returns: 'returns',
    iade: 'returns',
    garanti: 'returns',
    iade_garanti: 'returns',

    branches: 'branches',
    subeler: 'branches',

    logs: 'logs',
    guvenlik: 'logs',
    loglar: 'logs',

    template: 'template',
    sablon: 'template',
  };

  if (aliases[clean]) {
    return aliases[clean];
  }
  return null;
}

/**
 * Extracts normalized tab and filter from a URL string
 */
export function extractTabAndFilterFromUrl(urlStr?: string | null): {
  tab: TabType | null;
  filter: string | null;
} {
  if (!urlStr) return { tab: null, filter: null };
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://saha-takip-beige.vercel.app';
    const parsed = new URL(urlStr, base);
    const tabParam = parsed.searchParams.get('tab');
    const filterParam = parsed.searchParams.get('filter');
    return {
      tab: normalizeTab(tabParam),
      filter: filterParam || null,
    };
  } catch {
    return { tab: null, filter: null };
  }
}

/**
 * Automatically inspects the title and body of a notification to detect
 * the target section if no explicit URL or tab was provided.
 */
export function detectTabFromNotification(
  title?: string,
  body?: string
): { tab: TabType; filter?: string } {
  const combined = `${title || ''} ${body || ''}`.toLowerCase();

  // 1. Timed Follow Ups (Süreli Takip / Alarmlar)
  if (
    combined.includes('süreli takip') ||
    combined.includes('sureli takip') ||
    combined.includes('⏰') ||
    combined.includes('takip hatırlatması') ||
    combined.includes('cari takip') ||
    combined.includes('alarm')
  ) {
    return { tab: 'timed_follow_ups' };
  }

  // 2. Staff Tracking & Attendance & Leave Requests
  if (
    combined.includes('izin talebi') ||
    combined.includes('izin onay') ||
    combined.includes('izin redd') ||
    combined.includes('işe başladı') ||
    combined.includes('işten ayrıldı') ||
    combined.includes('mesai') ||
    combined.includes('mola') ||
    combined.includes('lokasyon dışı')
  ) {
    return { tab: 'staff_tracking' };
  }

  // 3. Work Orders (İş Emirleri / Notlar)
  if (
    combined.includes('iş emri') ||
    combined.includes('is emri') ||
    combined.includes('onay bekliyor') ||
    combined.includes('onaylandı') ||
    combined.includes('reddedildi') ||
    combined.includes('tamamlandı') ||
    combined.includes('📋')
  ) {
    let filter = 'pending';
    if (combined.includes('onaylandı')) filter = 'approved';
    if (combined.includes('reddedildi')) filter = 'rejected';
    if (combined.includes('hatırlatıcı')) filter = 'reminders';
    return { tab: 'notes', filter };
  }

  // 4. Installations (Kurulumlar)
  if (
    combined.includes('kurulum') ||
    combined.includes('montaj') ||
    combined.includes('yeni lokasyon')
  ) {
    let filter = '';
    if (combined.includes('onay bekliyor')) filter = 'pending_approval';
    if (combined.includes('onaylandı')) filter = 'approved';
    if (combined.includes('reddedildi')) filter = 'rejected';
    return { tab: 'installations', filter };
  }

  // 5. Services (Servisler)
  if (
    combined.includes('servis') ||
    combined.includes('arıza') ||
    combined.includes('bakım')
  ) {
    return { tab: 'services' };
  }

  // 6. Returns & Warranty (İade / Garanti)
  if (
    combined.includes('iade') ||
    combined.includes('garanti') ||
    combined.includes('durum takibi') ||
    combined.includes('🛡️')
  ) {
    return { tab: 'returns' };
  }

  // 7. Admin Reminders (Duyuru / Yönetici Notu)
  if (
    combined.includes('yönetici talimatı') ||
    combined.includes('yönetici notu') ||
    combined.includes('📢') ||
    combined.includes('📌')
  ) {
    return { tab: 'reminders' };
  }

  // 8. Branches (Şubeler)
  if (combined.includes('şube') || combined.includes('sube')) {
    return { tab: 'branches' };
  }

  // 9. Logs (Güvenlik / Log)
  if (
    combined.includes('güvenlik') ||
    combined.includes('log') ||
    combined.includes('şüpheli')
  ) {
    return { tab: 'logs' };
  }

  return { tab: 'home' };
}
