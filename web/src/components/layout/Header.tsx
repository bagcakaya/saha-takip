import React, { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { ArrowLeft, Building2, ClipboardList, ListTodo, LogOut, User, Users, ShieldCheck, RotateCcw, Home, Bell, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserManagementModal } from '../auth/UserManagementModal';
import { OneSignalService } from '../../services/oneSignalService';
import { NotificationService } from '../../services/notificationService';

export type TabType = 'home' | 'installations' | 'services' | 'notes' | 'returns' | 'template';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  subtitle: string;
  title: string;
  actionButton?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  subtitle,
  title,
  actionButton,
}) => {
  const { user, logout } = useAuth();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const handleNotificationClick = async () => {
    if (typeof window === 'undefined') return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIos && !isStandalone) {
      alert(
        "📱 iPhone (iOS) Kilit Ekranı Bildirimi İçin:\n\n" +
        "1. Safari alt çubuğundaki 'Paylaş' simgesine (kare ve yukarı ok) dokunun.\n" +
        "2. Menüyü kaydırıp 'Ana Ekrana Ekle' seçeneğine basın.\n" +
        "3. Ana ekrana eklenen uygulamayı açtığınızda gelen bildirim uyarısına 'İzin Ver' deyin.\n\n" +
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
        alert('🔔 Bildirimler aktif edildi! Artık telefon kilitliyken de iş emirleri ve güncellemeler anında iletilecektir.');
      } else {
        alert('⚠️ Bildirim izni verilmedi veya tarayıcı ayarlarınızdan engellendi. Lütfen tarayıcı/telefon ayarlarından izin verin.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left side: In 'home', show Logo + Title. In subpages, show prominent [ ← Ana Menü ] button + Page Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {activeTab !== 'home' ? (
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-black shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Ana Menüye Dön"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Ana Menü</span>
              </button>
            ) : (
              <img
                src="/icon.png"
                alt="Saha Takip Logo"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-xs border border-slate-200/80 dark:border-slate-700 bg-white shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}

            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-widest uppercase text-blue-600 dark:text-blue-400 block truncate">
                {subtitle}
              </span>
              <h1 className="text-base sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight truncate leading-tight">
                {title}
              </h1>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'home'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Ana Menü</span>
            </button>
            <button
              onClick={() => setActiveTab('installations')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'installations'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Kurulumlar</span>
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'services'
                  ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Servisler</span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>İş Emirleri</span>
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'returns'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>İade / Garanti</span>
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'template'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <ListTodo className="w-4 h-4" />
              <span>Şablon Yönetimi</span>
            </button>
          </div>

          {/* Right side: Admin Users Button, User Profile, Logout & Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {actionButton}

            {/* Admin-only User Management Button */}
            {isAdmin && (
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold transition-all active:scale-95 shadow-xs"
                title="Kullanıcı ve Yetki Yönetimi"
              >
                <Users className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="hidden sm:inline">Kullanıcılar</span>
              </button>
            )}

            {/* User Profile Badge */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-800 dark:text-slate-200">
                <div
                  className={`w-6 h-6 rounded-lg text-white flex items-center justify-center font-black text-[11px] ${
                    isAdmin ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                >
                  {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                </div>
                <span className="truncate max-w-[100px]">{user.name}</span>
              </div>
            )}

            {/* Notification Bell Status */}
            <button
              type="button"
              onClick={handleNotificationClick}
              className={`p-2 rounded-xl transition-all relative cursor-pointer ${
                permission === 'granted'
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 animate-pulse'
              }`}
              title={
                permission === 'granted'
                  ? 'Kilit Ekranı Bildirimleri Aktif'
                  : 'Bildirimler Kapalı - Tıklayıp Açın'
              }
              aria-label="Bildirim Durumu"
            >
              <Bell className="w-4 h-4" />
              {permission !== 'granted' && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

            <ThemeToggle />

            {/* Logout Button */}
            {user && (
              <button
                onClick={() => {
                  if (window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
                    logout();
                  }
                }}
                className="p-2 rounded-xl text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                title="Çıkış Yap"
                aria-label="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Admin User Management Modal */}
      {isAdmin && (
        <UserManagementModal
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
        />
      )}
    </>
  );
};
