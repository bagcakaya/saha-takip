import React, { useState } from 'react';
import {
  Building2,
  ClipboardList,
  RotateCcw,
  ListTodo,
  ArrowRight,
  Sparkles,
  Bell,
  Wrench,
  Settings,
  UserCheck,
  Megaphone,
  ShieldAlert,
  Store,
  Clock,
  X,
} from 'lucide-react';
import { TabType } from '../components/layout/Header';
import { isUserAdmin, canUserManageLicenses, canUserManageInstitutionsAndBranches } from '../types/auth';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { OneSignalService } from '../services/oneSignalService';
import { NotificationService } from '../services/notificationService';
import { NotificationStatusModal } from '../components/common/NotificationStatusModal';
import { LicenseManagementModal } from '../components/licensing/LicenseManagementModal';
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
  const { user } = useAuth();
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
  } = useStorage();
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<HomeModule | null>(null);

  const canManageLicenses = canUserManageLicenses(user);
  const canManageInstitutionsAndBranches = canUserManageInstitutionsAndBranches(user);

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

  const isAdmin = isUserAdmin(user);
  const pendingReturns = returnWarrantyItems.filter((i) => i.status === 'pending').length;
  const todayKey = new Date().toISOString().split('T')[0];
  const activeStaffCount = attendanceRecords.filter(
    (r) => r.date === todayKey && r.status === 'checked_in'
  ).length;

  // Kurulumlar (Installations) Counts
  const installationPendingCount = locations.filter(
    (loc) => !loc.status || loc.status === 'pending'
  ).length;

  // Servisler (Services) Counts
  const servicesPendingCount = services.filter(
    (s) => !s.status || s.status === 'pending'
  ).length;

  // İş Emirleri (Notes) Counts
  const notesPendingCount = notes.filter(
    (n) => !n.status || n.status === 'pending'
  ).length;

  const unreadRemindersCount = adminReminders.filter(
    (r) => !r.readBy || !r.readBy.includes(user?.id || '')
  ).length;

  const pendingTimedFollowUpsCount = timedFollowUps.filter((item) => {
    if (item.status !== 'pending') return false;
    const remainingDays = getRemainingDays(item.snoozedUntil || item.dueDate);
    return remainingDays !== null && remainingDays <= 15;
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
      badgeText: `${branches.length} Şube`,
      activeCount: branches.length,
      action: () => onNavigate('branches'),
      visible: canManageInstitutionsAndBranches,
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
      visible: true,
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
      visible: true,
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
      visible: true,
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
      visible: true,
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
      badgeText: pendingTimedFollowUpsCount > 0 ? `${pendingTimedFollowUpsCount} Bekleyen` : `${timedFollowUps.filter((i) => i.status === 'pending').length} Takip`,
      activeCount: pendingTimedFollowUpsCount,
      action: () => onNavigate('timed_follow_ups'),
      visible: isAdmin,
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
      badgeText: `${adminReminders.length || 1} Talimat`,
      activeCount: unreadRemindersCount,
      action: () => onNavigate('reminders'),
      visible: true,
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
      visible: true,
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
      badgeText: `${unreadLogsCount || securityLogs.length} Kayıt`,
      activeCount: unreadLogsCount,
      action: () => onNavigate('logs'),
      visible: isAdmin,
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
      badgeText: `${standardTasks.length} Görev`,
      action: () => onNavigate('template'),
      visible: true,
    },
    {
      id: 'notification-settings',
      title: 'Bildirim Ayarları',
      shortTitle: 'Bildirimler',
      description: 'Kilit ekranı izni, test gönderimi ve cihaz kontrolü',
      icon: Settings,
      gradient: 'bg-gradient-to-br from-indigo-600 via-slate-800 to-slate-900',
      borderColor: 'border-indigo-400/40',
      glowColor: 'text-indigo-400',
      badgeText: 'Canlı Durum',
      action: () => setIsNotificationSettingsOpen(true),
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
      visible: canManageLicenses,
    },
  ];

  const visibleModules = modules.filter((m) => m.visible);

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-10 animate-in fade-in duration-300">
      {/* 1. Compact Greeting & Status Bar (Tek ekrana sığdırma optimizasyonu) */}
      <div className="rounded-2xl sm:rounded-3xl bg-slate-900/90 text-white p-4 sm:p-6 shadow-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {isAdmin ? 'Sistem Yöneticisi' : 'Saha Yetkilisi'}
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
            <span className="text-sm sm:text-base font-black text-white">{locations.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-center">
            <span className="text-[9px] font-bold text-slate-300 block uppercase">Servis</span>
            <span className="text-sm sm:text-base font-black text-orange-400">{services.length}</span>
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
                onClick={() => setSelectedModule(mod)}
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

      {/* 3. Görsel-2: Tıklandığında Büyüyen Kart ve Flu Arka Plan Pop-up */}
      {selectedModule && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedModule(null)}
        >
          <div
            className={`relative max-w-sm w-full rounded-3xl p-6 shadow-2xl text-white border transition-all animate-in zoom-in-95 duration-200 ${selectedModule.gradient} ${selectedModule.borderColor}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Row: Squircle Icon & Badge */}
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner">
                <selectedModule.icon className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-black/35 text-white border border-white/20 backdrop-blur-xs">
                {selectedModule.badgeText}
              </span>
            </div>

            {/* Middle: Title with Arrow & Full Description */}
            <div className="space-y-2 mb-6">
              <h4 className="text-xl font-black tracking-tight flex items-center gap-2">
                <span>{selectedModule.title}</span>
                <ArrowRight className="w-5 h-5 text-white/90" />
              </h4>
              <p className="text-sm text-white/90 font-medium leading-relaxed">
                {selectedModule.description}
              </p>
            </div>

            {/* Bottom CTA Action Button */}
            <button
              type="button"
              onClick={() => {
                const act = selectedModule.action;
                setSelectedModule(null);
                act();
              }}
              className="w-full py-3 rounded-2xl bg-white/20 hover:bg-white/30 active:bg-white/40 border border-white/30 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md"
            >
              <span>Bölüme Giriş Yap</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Close 'X' Button */}
            <button
              type="button"
              onClick={() => setSelectedModule(null)}
              className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-black/25 hover:bg-black/40 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      <NotificationStatusModal
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
      />

      {/* SaaS License Management Modal (Super Admin: admin & murat) */}
      {canManageLicenses && (
        <LicenseManagementModal
          isOpen={isLicenseModalOpen}
          onClose={() => setIsLicenseModalOpen(false)}
        />
      )}
    </div>
  );
};
