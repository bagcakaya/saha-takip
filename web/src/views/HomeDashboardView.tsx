import React, { useState } from 'react';
import {
  Building2,
  ClipboardList,
  RotateCcw,
  ListTodo,
  Sparkles,
  Bell,
  Wrench,
  UserCheck,
  Megaphone,
  ShieldAlert,
  Store,
  Clock,
  StickyNote,
  ChevronDown,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { TabType } from '../components/layout/Header';
import { isUserAdmin, isSuperAdmin, canUserManageLicenses, canUserManageInstitutionsAndBranches, isModulePermitted } from '../types/auth';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { OneSignalService } from '../services/oneSignalService';
import { NotificationService } from '../services/notificationService';
import { NotificationListModal } from '../components/common/NotificationListModal';
import { LicenseManagementModal } from '../components/licensing/LicenseManagementModal';
import { CompanyLicenseDetailsModal } from '../components/licensing/CompanyLicenseDetailsModal';
import { CompanySelectModal } from '../components/common/CompanySelectModal';
import { getRemainingDays } from '../utils/dateUtils';

interface HomeDashboardViewProps {
  onNavigate: (tab: TabType) => void;
}

interface HomeModule {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: any;
  gradient: string;
  borderColor: string;
  glowColor: string;
  badgeText: string;
  activeCount?: number;
  action: () => void;
  visible: boolean;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({ onNavigate }) => {
  const { user, company, licenseInfo, switchViewingCompany } = useAuth();
  const {
    branches,
    locations,
    notes,
    returnWarrantyItems,
    standardTasks,
    services,
    attendanceRecords,
    adminReminders,
    securityLogs,
    unreadLogsCount,
    timedFollowUps,
    personalNotes,
    jobApplications,
    badgeCount,
    lastReadTime,
    markAllAsRead,
  } = useStorage();
  const [isNotificationListOpen, setIsNotificationListOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isCompanyLicenseModalOpen, setIsCompanyLicenseModalOpen] = useState(false);
  const [isCompanySelectOpen, setIsCompanySelectOpen] = useState(false);

  const canManageLicenses = canUserManageLicenses(user);
  const canManageInstitutionsAndBranches = canUserManageInstitutionsAndBranches(user);

  const activeCompanyCode = (company?.code || user?.companyCode || 'POLATLAR').trim().toUpperCase();
  const activeCompanyName = company?.name || (activeCompanyCode === 'POLATLAR' ? 'Polatlar' : activeCompanyCode);
  const isViewingOtherCompany = isSuperAdmin(user) && activeCompanyCode !== 'POLATLAR';

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined') return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIos && !isStandalone) {
      alert(
        "📱 iPhone (iOS) Kilit Ekranı Bildirimi İçin:\n\n" +
        "1. Safari alt menüsündeki 'Paylaş' simgesine (kare ve yukarı ok) dokunun.\n" +
        "2. Menüyü kaydırıp 'Ana Ekrana Ekle' seçeneğine basın.\n" +
        "3. Ana ekrandan uygulamayı açtığınızda bildirim iznine 'İzin Ver' deyin.\n\n" +
        "Apple kuralları gereği Safari sekmesinde kilit ekranı bildirimi desteklenmemektedir."
      );
      return;
    }

    try {
      await NotificationService.requestPermission();
      const granted = await OneSignalService.requestPermission();
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
      if (granted || Notification.permission === 'granted') {
        alert('🔔 Bildirimler başarıyla açıldı! Artık telefonunuz kilitliyken de anlık iş emirleri ve güncellemeleri alacaksınız.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Defensive fallbacks for all arrays from storage
  const safeBranches = Array.isArray(branches) ? branches : [];
  const safeLocations = Array.isArray(locations) ? locations : [];
  const safeServices = Array.isArray(services) ? services : [];
  const safeNotes = Array.isArray(notes) ? notes : [];
  const safeReturnWarrantyItems = Array.isArray(returnWarrantyItems) ? returnWarrantyItems : [];
  const safeAttendanceRecords = Array.isArray(attendanceRecords) ? attendanceRecords : [];
  const safeAdminReminders = Array.isArray(adminReminders) ? adminReminders : [];
  const safeStandardTasks = Array.isArray(standardTasks) ? standardTasks : [];
  const safeSecurityLogs = Array.isArray(securityLogs) ? securityLogs : [];
  const safeTimedFollowUps = Array.isArray(timedFollowUps) ? timedFollowUps : [];
  const safePersonalNotes = Array.isArray(personalNotes) ? personalNotes : [];
  const userPersonalNotes = safePersonalNotes.filter((n) => n && n.userId === user?.id);
  const safeJobApplications = Array.isArray(jobApplications) ? jobApplications : [];
  const newJobApplicationsCount = safeJobApplications.filter((a) => a && a.status === 'new').length;

  const isAdmin = isUserAdmin(user);
  const pendingReturns = safeReturnWarrantyItems.filter((i) => i && i.status === 'pending').length;
  const todayKey = new Date().toISOString().split('T')[0];
  const activeStaffCount = safeAttendanceRecords.filter(
    (r) => r && r.date === todayKey && r.status === 'checked_in'
  ).length;

  // Kurulumlar (Installations) Counts
  const installationPendingCount = safeLocations.filter(
    (loc) => loc && (!loc.status || loc.status === 'pending')
  ).length;

  // Servisler (Services) Counts
  const servicesPendingCount = safeServices.filter(
    (s) => s && (!s.status || s.status === 'pending')
  ).length;

  // İş Emirleri (Notes) Counts
  const notesPendingCount = safeNotes.filter(
    (n) => n && (!n.status || n.status === 'pending')
  ).length;

  const unreadRemindersCount = safeAdminReminders.filter((r) => {
    if (!r) return false;
    if (!r.readBy) return true;
    if (Array.isArray(r.readBy)) {
      return !r.readBy.includes(user?.id || '');
    }
    return true;
  }).length;

  const pendingTimedFollowUpsCount = safeTimedFollowUps.filter((item) => {
    if (!item || item.status !== 'pending') return false;
    try {
      const remainingDays = getRemainingDays(item.snoozedUntil || item.dueDate);
      return remainingDays !== null && remainingDays <= 15;
    } catch {
      return false;
    }
  }).length;

  const todayStr = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // All modules definitions matching Görsel-1 and Görsel-2
  const modules: HomeModule[] = [
    {
      id: 'branches',
      title: 'Kurum ve Şubeler',
      shortTitle: 'Kurum & Şube',
      description: 'Kurumlar, şubeler, konumlar ve personel atamaları',
      icon: Store,
      gradient: 'bg-gradient-to-br from-cyan-600 via-teal-700 to-indigo-900',
      borderColor: 'border-cyan-400/40',
      glowColor: 'text-cyan-400',
      badgeText: `${safeBranches.length} Şube`,
      activeCount: safeBranches.length,
      action: () => onNavigate('branches'),
      visible: canManageInstitutionsAndBranches && !isViewingOtherCompany,
    },
    {
      id: 'installations',
      title: 'Kurulumlar',
      shortTitle: 'Kurulumlar',
      description: 'Saha montajları, müşteri adresleri ve kontrol listeleri',
      icon: Building2,
      gradient: 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800',
      borderColor: 'border-blue-400/40',
      glowColor: 'text-blue-400',
      badgeText: `${installationPendingCount} Bekleyen`,
      activeCount: installationPendingCount,
      action: () => onNavigate('installations'),
      visible: isModulePermitted('installations', user, company),
    },
    {
      id: 'services',
      title: 'Servisler',
      shortTitle: 'Servisler',
      description: 'Müşteri servis müdahaleleri, parça ve yapılan iş kayıtları',
      icon: Wrench,
      gradient: 'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700',
      borderColor: 'border-amber-400/40',
      glowColor: 'text-amber-400',
      badgeText: `${servicesPendingCount} Bekleyen`,
      activeCount: servicesPendingCount,
      action: () => onNavigate('services'),
      visible: isModulePermitted('services', user, company),
    },
    {
      id: 'notes',
      title: 'İş Emirleri',
      shortTitle: 'İş Takip',
      description: 'Personele görev atama, alarmlar ve anlık iş emirleri',
      icon: ClipboardList,
      gradient: 'bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-900',
      borderColor: 'border-purple-400/40',
      glowColor: 'text-purple-400',
      badgeText: `${notesPendingCount} Bekleyen`,
      activeCount: notesPendingCount,
      action: () => onNavigate('notes'),
      visible: isModulePermitted('notes', user, company),
    },
    {
      id: 'staff_tracking',
      title: 'Personel Takibi',
      shortTitle: 'Personel Takip',
      description: 'Lokasyon doğrulamalı ve yönetici onaylı işe giriş-çıkış takibi',
      icon: UserCheck,
      gradient: 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900',
      borderColor: 'border-emerald-400/40',
      glowColor: 'text-emerald-400',
      badgeText: 'Takip',
      activeCount: activeStaffCount,
      action: () => onNavigate('staff_tracking'),
      visible: isModulePermitted('staff_tracking', user, company),
    },
    {
      id: 'job_applications',
      title: 'İş Başvuruları',
      shortTitle: 'İş Başvurusu',
      description: 'Aday özgeçmişleri, mülakat süreci ve personelleştirme',
      icon: UserPlus,
      gradient: 'bg-gradient-to-br from-teal-600 via-emerald-700 to-indigo-950',
      borderColor: 'border-teal-400/40',
      glowColor: 'text-teal-400',
      badgeText:
        newJobApplicationsCount > 0
          ? `${newJobApplicationsCount} Yeni`
          : `${safeJobApplications.length} Aday`,
      activeCount: newJobApplicationsCount > 0 ? newJobApplicationsCount : undefined,
      action: () => onNavigate('job_applications'),
      visible: isModulePermitted('job_applications', user, company),
    },
    {
      id: 'timed_follow_ups',
      title: 'Süreli Takipler',
      shortTitle: 'Süreli Takip',
      description: 'Cari bazlı randevu, ödeme ve zaman ayarlı iş hatırlatıcıları',
      icon: Clock,
      gradient: 'bg-gradient-to-br from-amber-600 via-amber-700 to-yellow-800',
      borderColor: 'border-amber-400/40',
      glowColor: 'text-amber-400',
      badgeText:
        pendingTimedFollowUpsCount > 0
          ? `${pendingTimedFollowUpsCount} Bekleyen`
          : `${safeTimedFollowUps.filter((i) => i && i.status === 'pending').length} Takip`,
      activeCount: pendingTimedFollowUpsCount,
      action: () => onNavigate('timed_follow_ups'),
      visible: isModulePermitted('timed_follow_ups', user, company),
    },
    {
      id: 'personal_notes',
      title: 'Kişisel Notlarım',
      shortTitle: 'Notlarım',
      description: 'Sadece size özel, hatırlatıcılı ve doğrudan düzenlenebilir notlar',
      icon: StickyNote,
      gradient: 'bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-700',
      borderColor: 'border-amber-400/40',
      glowColor: 'text-amber-400',
      badgeText: `${userPersonalNotes.length} Not`,
      activeCount: userPersonalNotes.length > 0 ? userPersonalNotes.length : undefined,
      action: () => onNavigate('personal_notes'),
      visible: isModulePermitted('personal_notes', user, company),
    },
    {
      id: 'reminders',
      title: 'Hatırlatmalar',
      shortTitle: 'Hatırlatma',
      description: 'Yönetici çalışma talimatları, kurallar ve prosedürler',
      icon: Megaphone,
      gradient: 'bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800',
      borderColor: 'border-indigo-400/40',
      glowColor: 'text-indigo-400',
      badgeText: `${safeAdminReminders.length || 1} Talimat`,
      activeCount: unreadRemindersCount,
      action: () => onNavigate('reminders'),
      visible: isModulePermitted('reminders', user, company),
    },
    {
      id: 'returns',
      title: 'İade / Garanti',
      shortTitle: 'İade & Garanti',
      description: 'Seri no, kargo fişi ve 1 haftalık otomatik durum takibi',
      icon: RotateCcw,
      gradient: 'bg-gradient-to-br from-rose-600 via-red-700 to-rose-900',
      borderColor: 'border-rose-400/40',
      glowColor: 'text-rose-400',
      badgeText: `${pendingReturns} Süreçte`,
      activeCount: pendingReturns,
      action: () => onNavigate('returns'),
      visible: isModulePermitted('returns', user, company),
    },
    {
      id: 'logs',
      title: 'Log Kayıtları',
      shortTitle: 'Log Kayıtları',
      description: 'Cihaz uyuşmazlığı ve yetkisiz giriş denemeleri takibi',
      icon: ShieldAlert,
      gradient: 'bg-gradient-to-br from-red-800 via-red-900 to-slate-950',
      borderColor: 'border-red-500/40',
      glowColor: 'text-red-400',
      badgeText: `${unreadLogsCount || safeSecurityLogs.length} Kayıt`,
      activeCount: unreadLogsCount,
      action: () => onNavigate('logs'),
      visible: isModulePermitted('logs', user, company),
    },
    {
      id: 'template',
      title: 'Şablon',
      shortTitle: 'Şablonlar',
      description: 'Standart kontrol listesi görevleri & tam veri seti yönetimi',
      icon: ListTodo,
      gradient: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800',
      borderColor: 'border-emerald-400/40',
      glowColor: 'text-emerald-400',
      badgeText: `${safeStandardTasks.length} Görev`,
      action: () => onNavigate('template'),
      visible: isModulePermitted('template', user, company),
    },
    {
      id: 'notifications',
      title: 'Gelen Bildirimler',
      shortTitle: 'Bildirimler',
      description: 'Saha güncellemeleri, onaylar ve sistem bildirimleri',
      icon: Bell,
      gradient: 'bg-gradient-to-br from-amber-600 via-orange-700 to-slate-900',
      borderColor: 'border-amber-400/40',
      glowColor: 'text-amber-400',
      badgeText: badgeCount > 0 ? `${badgeCount} Bildirim` : '0 Bildirim',
      activeCount: badgeCount > 0 ? badgeCount : undefined,
      action: () => setIsNotificationListOpen(true),
      visible: true,
    },
    {
      id: 'licensing',
      title: 'Lisanslama',
      shortTitle: 'Lisanslama',
      description: 'Kurum lisans süreleri, dondurma ve abonelik kontrolü',
      icon: Sparkles,
      gradient: 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-950',
      borderColor: 'border-blue-400/40',
      glowColor: 'text-blue-400',
      badgeText: 'SaaS Masası',
      action: () => setIsLicenseModalOpen(true),
      visible: canManageLicenses && !isViewingOtherCompany,
    },
    {
      id: 'my_company_license',
      title: 'Kurumsal Lisansım',
      shortTitle: 'Lisansım',
      description: licenseInfo.isLifetime
        ? 'Sınırsız / Ömür Boyu Kurumsal Lisans'
        : `${licenseInfo.remainingDays} gün kaldı • Bitiş: ${licenseInfo.expiresDateFormatted || 'Belirtilmedi'}`,
      icon: ShieldCheck,
      gradient: licenseInfo.status === 'expiring_soon'
        ? 'bg-gradient-to-br from-amber-600 via-orange-700 to-slate-900'
        : licenseInfo.status === 'expired'
        ? 'bg-gradient-to-br from-rose-700 via-red-800 to-slate-950'
        : 'bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900',
      borderColor: licenseInfo.status === 'expiring_soon'
        ? 'border-amber-400/50'
        : licenseInfo.status === 'expired'
        ? 'border-rose-400/50'
        : 'border-emerald-400/40',
      glowColor: licenseInfo.status === 'expiring_soon'
        ? 'text-amber-400'
        : licenseInfo.status === 'expired'
        ? 'text-rose-400'
        : 'text-emerald-400',
      badgeText: licenseInfo.isLifetime
        ? 'Sınırsız'
        : licenseInfo.status === 'expiring_soon'
        ? `${licenseInfo.remainingDays} Gün (Yenileme Yaklaştı)`
        : licenseInfo.status === 'expired'
        ? 'Süresi Doldu'
        : `${licenseInfo.remainingDays} Gün Kaldı`,
      action: () => setIsCompanyLicenseModalOpen(true),
      visible: isAdmin && !canManageLicenses,
    },
  ];

  const visibleModules = modules.filter((m) => m.visible);

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-10 animate-in fade-in duration-300">
      {/* 0. Görsel-2: Süper Yönetici Kurum Filtresi (Sadece murat ve POLATLAR admin) */}
      {isSuperAdmin(user) && (
        <div className="rounded-2xl sm:rounded-3xl bg-slate-900/95 text-white p-3.5 sm:p-4 shadow-xl border border-blue-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-sky-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-300">Kurum:</span>
            <button
              type="button"
              onClick={() => setIsCompanySelectOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/80 border-2 border-blue-600 hover:border-blue-400 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-950/50 transition-all cursor-pointer group"
            >
              <span className="truncate max-w-[200px] sm:max-w-none">
                {activeCompanyName} ({activeCompanyCode})
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors shrink-0" />
            </button>
          </div>

          {isViewingOtherCompany && (
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {activeCompanyName} Yönetici Görünümü
              </span>
              <button
                type="button"
                onClick={() => switchViewingCompany('POLATLAR')}
                className="text-[11px] font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer"
              >
                POLATLAR'a Dön
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1. Compact Greeting & Status Bar (Tek ekrana sığdırma optimizasyonu) */}
      <div className="rounded-2xl sm:rounded-3xl bg-slate-900/90 text-white p-4 sm:p-6 shadow-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {isAdmin ? 'Sistem Yöneticisi' : 'Personel'}
            </span>
            <span className="text-xs text-slate-400 capitalize">{todayStr}</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
            Hoş Geldiniz, {user?.name || 'Yetkili'} 👋
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-center">
            <span className="text-[9px] font-bold text-slate-300 block uppercase">Kurulum</span>
            <span className="text-sm sm:text-base font-black text-white">{safeLocations.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-center">
            <span className="text-[9px] font-bold text-slate-300 block uppercase">Servis</span>
            <span className="text-sm sm:text-base font-black text-orange-400">{safeServices.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-center">
            <span className="text-[9px] font-bold text-slate-300 block uppercase">İade</span>
            <span className="text-sm sm:text-base font-black text-amber-400">{pendingReturns}</span>
          </div>
        </div>
      </div>

      {/* Push Notification Status Alert */}
      {permission !== 'granted' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-4 h-4 text-amber-500 shrink-0 animate-bounce" />
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 truncate">
              Kilit ekranı bildirimlerini açarak anlık iş emirlerini alabilirsiniz.
            </span>
          </div>
          <button
            type="button"
            onClick={handleRequestNotifications}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shrink-0 transition cursor-pointer"
          >
            Bildirimleri Aç
          </button>
        </div>
      )}

      {/* 2. Görsel-1: 3-Sütunlu Dairesel Uygulama İkon Grid'i (Tek Ekrana Sığan Görünüm) */}
      <div className="pt-2">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-y-7 gap-x-2 sm:gap-6 py-2">
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => mod.action()}
                className="flex flex-col items-center justify-start group cursor-pointer focus:outline-none transition-transform active:scale-95"
              >
                {/* Dairesel Neon Çerçeveli İkon */}
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-900/90 dark:bg-slate-900 border-2 border-slate-700/60 group-hover:scale-110 group-hover:border-amber-400 transition-all duration-200 flex items-center justify-center shadow-lg shadow-black/30">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <Icon className={`w-7 h-7 ${mod.glowColor}`} />
                  </div>

                  {/* Aktif Bildirim / Bekleyen Rozeti */}
                  {mod.activeCount !== undefined && mod.activeCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black border-2 border-slate-950 shadow-md">
                      {mod.activeCount > 99 ? '99+' : mod.activeCount}
                    </span>
                  )}
                </div>

                {/* İkon Altındaki Modül İsmi */}
                <span className="mt-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 text-center leading-tight group-hover:text-amber-500 transition-colors max-w-[95px]">
                  {mod.shortTitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Realtime Notification Drawer / List Modal */}
      {isNotificationListOpen && (
        <NotificationListModal
          isOpen={isNotificationListOpen}
          onClose={() => setIsNotificationListOpen(false)}
          lastReadTime={lastReadTime}
          onMarkAllAsRead={markAllAsRead}
          onNavigate={(tab, filter) => {
            onNavigate(tab);
            if (filter) {
              if (tab === 'staff_tracking') {
                window.dispatchEvent(
                  new CustomEvent('saha:set-staff-subtab', { detail: { subTab: filter } })
                );
              } else if (tab === 'notes') {
                window.dispatchEvent(
                  new CustomEvent('saha:set-notes-filter', { detail: { filter } })
                );
              }
            }
          }}
        />
      )}

      {/* SaaS License Management Modal (Super Admin: admin & murat) */}
      {canManageLicenses && isLicenseModalOpen && (
        <LicenseManagementModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
        />
      )}

      {/* Client Company Manager License Details Modal */}
      {isAdmin && !canManageLicenses && isCompanyLicenseModalOpen && (
        <CompanyLicenseDetailsModal
          isOpen={isCompanyLicenseModalOpen}
          onClose={() => setIsCompanyLicenseModalOpen(false)}
        />
      )}

      {/* Super Admin Kurum Seçim Modalı */}
      {isSuperAdmin(user) && (
        <CompanySelectModal
          isOpen={isCompanySelectOpen}
          onClose={() => setIsCompanySelectOpen(false)}
          currentCompanyCode={activeCompanyCode}
          onSelectCompany={(code) => switchViewingCompany(code)}
        />
      )}
    </div>
  );
};
