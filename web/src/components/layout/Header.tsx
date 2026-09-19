import React, { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { ArrowLeft, Building2, ClipboardList, ListTodo, LogOut, User, Users, ShieldCheck, ShieldAlert, RotateCcw, Home, Bell, Wrench, UserCheck, Megaphone, Store, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';
import { UserManagementModal } from '../auth/UserManagementModal';
import { CreateCompanyModal } from '../auth/CreateCompanyModal';
import { OneSignalService } from '../../services/oneSignalService';
import { NotificationListModal } from '../common/NotificationListModal';
import { useStorage } from '../../context/StorageContext';

export type TabType = 'home' | 'branches' | 'installations' | 'services' | 'notes' | 'staff_tracking' | 'timed_follow_ups' | 'reminders' | 'returns' | 'logs' | 'template';

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
  const { user, logout, deleteUser } = useAuth();
  const {
    unreadLogsCount,
    lastReadTime,
    markAllAsRead,
    badgeCount,
  } = useStorage();
  const isAdmin = isUserAdmin(user);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isNotificationListOpen, setIsNotificationListOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  const handleNotificationClick = () => {
    if (typeof window === 'undefined') return;

    // 1. Mark all notifications as read immediately so the badge count clears!
    markAllAsRead();

    // 2. Open notification list drawer / modal
    setIsNotificationListOpen(true);

    // Sync in background non-blocking
    if (user) {
      OneSignalService.loginUser(user.id, user.name, user.role);
    }
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (
      window.confirm(
        'Hesabınızı kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz. Kullanıcı hesabınız, kişisel oturum bilgileriniz ve bildirim kayıtlarınız kalıcı olarak silinecektir.'
      )
    ) {
      const res = await deleteUser(user.id);
      if (res.success) {
        alert('Hesabınız başarıyla silindi.');
        logout();
      } else {
        alert('İşlem Başarısız: ' + (res.error || 'Hesap silinemedi.'));
      }
    }
  };

  return (
    <>
      <header
        className="lg:hidden sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3.5 sm:px-6 transition-colors shadow-xs w-full max-w-full overflow-hidden"
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 24px), 64px)',
          paddingBottom: '14px',
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Left side: In 'home', show Logo + Title. In subpages, show prominent [ ← Ana Menü ] button + Page Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            {activeTab !== 'home' ? (
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-black shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Ana Menüye Dön"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Ana Menü</span>
              </button>
            ) : (
              <img
                src="/icon.png"
                alt="İş Takip Logo"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-xs border border-slate-200/80 dark:border-slate-700 bg-white shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}

            <div className="min-w-0 flex-1">
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-widest uppercase text-blue-600 dark:text-blue-400 block truncate">
                {subtitle}
              </span>
              <h1 className="text-sm sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight truncate leading-tight">
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
            {isAdmin && (
              <button
                onClick={() => setActiveTab('branches')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'branches'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>Şubeler</span>
              </button>
            )}
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
              onClick={() => setActiveTab('staff_tracking')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'staff_tracking'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Personel Takibi</span>
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'reminders'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>Hatırlatmalar</span>
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
            {isAdmin && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'logs'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Log Kayıtları</span>
                {unreadLogsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {unreadLogsCount}
                  </span>
                )}
              </button>
            )}
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

            {/* Admin-only Create Company Button (For Polatlar Admins) */}
            {isAdmin && (user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR' && (
              <button
                type="button"
                onClick={() => setIsCreateCompanyOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                title="Yeni Kurum / Firma Ekle"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Yeni Kurum</span>
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
              className={`p-2.5 rounded-xl transition-all relative cursor-pointer ${
                permission === 'granted'
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 animate-pulse'
              }`}
              title={
                badgeCount > 0
                  ? `${badgeCount} bekleyen iş / bildirim`
                  : permission === 'granted'
                  ? 'Kilit Ekranı Bildirimleri Aktif'
                  : 'Bildirimler Kapalı - Tıklayıp Açın'
              }
              aria-label="Bildirim Durumu"
            >
              <Bell className="w-4 h-4" />
              {badgeCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-in zoom-in">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              ) : permission !== 'granted' ? (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
              ) : null}
            </button>

            <ThemeToggle />

            {/* Logout Button */}
            {user && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
                    logout();
                  }
                }}
                className="p-2.5 rounded-xl text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
                title="Çıkış Yap"
                aria-label="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            {/* Delete Account Button */}
            {user && (
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 bg-slate-50 dark:bg-slate-800/80 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition-colors cursor-pointer"
                title="Hesabımı Sil"
                aria-label="Hesabımı Sil"
              >
                <UserX className="w-4 h-4" />
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

      {/* Create Company Modal (For Polatlar Admins) */}
      {isAdmin && (user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR' && (
        <CreateCompanyModal
          isOpen={isCreateCompanyOpen}
          onClose={() => setIsCreateCompanyOpen(false)}
        />
      )}

      {/* Realtime Notification Drawer / List Modal */}
      <NotificationListModal
        isOpen={isNotificationListOpen}
        onClose={() => setIsNotificationListOpen(false)}
        lastReadTime={lastReadTime}
        onMarkAllAsRead={markAllAsRead}
        onNavigate={(tab, filter) => {
          setActiveTab(tab);
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
    </>
  );
};
