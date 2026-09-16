import React, { useEffect, useState } from 'react';
import {
  Building2,
  ClipboardList,
  RotateCcw,
  ListTodo,
  Users,
  LogOut,
  User as UserIcon,
  Crown,
  MapPin,
  Home,
  Bell,
  Wrench,
  UserCheck,
  Megaphone,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { TabType } from './Header';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { ThemeToggle } from './ThemeToggle';
import { UserManagementModal } from '../auth/UserManagementModal';
import { CreateCompanyModal } from '../auth/CreateCompanyModal';
import { WeatherService } from '../../services/weatherService';
import { WeatherData, isUserAdmin } from '../../types/auth';
import { OneSignalService } from '../../services/oneSignalService';
import { NotificationListModal } from '../common/NotificationListModal';
import { CariListModal } from '../common/CariListModal';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const {
    branches,
    locations,
    notes,
    returnWarrantyItems,
    services,
    attendanceRecords,
    adminReminders,
    leaveRequests,
    unreadLogsCount,
    cariler,
    lastReadTime,
    markAllAsRead,
    badgeCount,
  } = useStorage();
  const [isCariListOpen, setIsCariListOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isNotificationListOpen, setIsNotificationListOpen] = useState(false);

  const isAdmin = isUserAdmin(user);

  // Live weather state for sidebar
  const [weather, setWeather] = useState<WeatherData>({
    timeOfDay: 'day',
    condition: 'clear',
    temperature: 24,
    weatherText: 'Açık Gökyüzü',
    locationName: 'Konum',
    isDay: true,
  });

  useEffect(() => {
    let isMounted = true;
    WeatherService.getCurrentWeather().then((w) => {
      if (isMounted) setWeather(w);
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

    // 2. Open notification list modal
    setIsNotificationListOpen(true);

    // Sync in background non-blocking
    if (user) {
      OneSignalService.loginUser(user.id, user.name, user.role);
    }
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  };

  const remindersCount = notes.filter((n) => n.reminderActive && n.reminderDate).length;
  const todayStr = React.useMemo(() => new Date().toISOString().split('T')[0], []);
  const activeStaffCount = React.useMemo(() => {
    return attendanceRecords.filter((r) => r.date === todayStr && r.status === 'checked_in').length;
  }, [attendanceRecords, todayStr]);

  const pendingStaffApprovalCount = React.useMemo(() => {
    if (!isAdmin) return 0;
    const pendingAttendance = attendanceRecords.filter(
      (r) => r.status === 'pending_checkin_approval' || r.status === 'pending_checkout_approval'
    ).length;
    const pendingLeaves = leaveRequests.filter((l) => l.status === 'pending').length;
    return pendingAttendance + pendingLeaves;
  }, [attendanceRecords, leaveRequests, isAdmin]);

  const unreadRemindersCount = React.useMemo(() => {
    if (!user?.id || isAdmin) return 0;
    return adminReminders.filter((r) => !r.readBy?.includes(user.id)).length;
  }, [adminReminders, user, isAdmin]);

  return (
    <>
      <aside className="hidden lg:flex flex-col justify-between w-64 xl:w-72 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 p-5 h-screen sticky top-0 shrink-0 select-none transition-colors z-20">
        {/* Top: Branding & Logo */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/icon.png"
                alt="Saha Takip Logo"
                className="w-11 h-11 rounded-2xl object-contain shadow-xs border border-slate-200 dark:border-slate-700 bg-white p-0.5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            </div>

            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-widest uppercase text-blue-600 dark:text-blue-400 block">
                Saha Takip
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-50 tracking-tight leading-tight truncate">
                Rapor Portalı
              </h2>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {/* 0. Ana Menü (Dashboard Hub) */}
            <button
              onClick={() => setActiveTab('home')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'home'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className="w-4 h-4" />
                <span>Ana Menü</span>
              </div>
            </button>

            {/* 0.5. Şubeler */}
            <button
              onClick={() => setActiveTab('branches')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                activeTab === 'branches'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Store className="w-4 h-4" />
                <span>Şubeler</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'branches'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {branches.length}
              </span>
            </button>

            {/* 1. Kurulumlar */}
            <button
              onClick={() => setActiveTab('installations')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'installations'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4" />
                <span>Kurulumlar</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'installations'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {locations.length}
              </span>
            </button>

            {/* 2. Servisler */}
            <button
              onClick={() => setActiveTab('services')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'services'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4" />
                <span>Servisler</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'services'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {services.length}
              </span>
            </button>

            {/* 3. İş Emirleri & Hatırlatıcılar */}
            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'notes'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4" />
                <span>İş Emirleri & Hatırlatıcı</span>
              </div>
              {remindersCount > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === 'notes'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {remindersCount} Alarm
                </span>
              )}
            </button>

            {/* 4. Personel Takibi */}
            <button
              onClick={() => setActiveTab('staff_tracking')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'staff_tracking'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <UserCheck className="w-4 h-4" />
                <span>Personel Takibi</span>
              </div>
              <div className="flex items-center gap-1.5">
                {pendingStaffApprovalCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                      activeTab === 'staff_tracking'
                        ? 'bg-amber-300 text-amber-950 font-black'
                        : 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse'
                    }`}
                    title={`${pendingStaffApprovalCount} onay bekleyen talep`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    {pendingStaffApprovalCount} Onay
                  </span>
                )}
                {activeStaffCount > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                      activeTab === 'staff_tracking'
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {activeStaffCount} Aktif
                  </span>
                )}
              </div>
            </button>

            {/* 5. Hatırlatmalar (Yönetici Talimatları) */}
            <button
              onClick={() => setActiveTab('reminders')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'reminders'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Megaphone className="w-4 h-4" />
                <span>Hatırlatmalar</span>
              </div>
              {unreadRemindersCount > 0 ? (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === 'reminders'
                      ? 'bg-white/20 text-white'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 animate-pulse'
                  }`}
                >
                  {unreadRemindersCount} Yeni
                </span>
              ) : (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === 'reminders'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {adminReminders.length}
                </span>
              )}
            </button>

            {/* 6. İade / Garanti Takibi */}
            <button
              onClick={() => setActiveTab('returns')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'returns'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <RotateCcw className="w-4 h-4" />
                <span>İade / Garanti Takibi</span>
              </div>
              {returnWarrantyItems.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === 'returns'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {returnWarrantyItems.length}
                </span>
              )}
            </button>

            {/* Log Kayıtları (Yalnızca Yönetici) */}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('logs')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                  activeTab === 'logs'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Log Kayıtları</span>
                </div>
                {unreadLogsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                    {unreadLogsCount}
                  </span>
                )}
              </button>
            )}

            {/* 4. Şablon Yönetimi */}
            <button
              onClick={() => setActiveTab('template')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'template'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <ListTodo className="w-4 h-4" />
                <span>Şablon Yönetimi</span>
              </div>
            </button>

            {/* 5. Cari Listesi (POLATLAR2025 / Excel) */}
            {((user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR' || cariler.length > 0) && (
              <button
                type="button"
                onClick={() => setIsCariListOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all duration-150 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <span>Cari Listesi</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                  {cariler.length}
                </span>
              </button>
            )}

            {/* 4. Kullanıcı Yönetimi (Admin Only) */}
            {isAdmin && (
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 border border-amber-200/80 dark:border-amber-900/50 transition-all duration-150 mt-3"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Kullanıcı Yönetimi</span>
                </div>
                <span className="p-1 rounded-md bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold">
                  Admin
                </span>
              </button>
            )}

            {/* 5. Yeni Kurum / Firma Ekle (Sadece Polatlar / Kurum Yöneticileri) */}
            {isAdmin && (user?.companyCode || 'POLATLAR').toUpperCase() === 'POLATLAR' && (
              <button
                type="button"
                onClick={() => setIsCreateCompanyOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 border border-blue-200/80 dark:border-blue-900/50 transition-all duration-150 mt-1.5 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Yeni Kurum Ekle</span>
                </div>
                <span className="p-1 rounded-md bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 text-[10px] font-extrabold">
                  Firma
                </span>
              </button>
            )}
          </nav>
        </div>

        {/* Bottom Section: Weather Widget, Profile & Logout */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {/* Live Weather Widget */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-500" />
                <span className="truncate max-w-[110px]">{weather.locationName}</span>
              </span>
              <span className="text-slate-700 dark:text-slate-200">{weather.temperature}°C</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block truncate capitalize">
              {weather.weatherText}
            </span>
          </div>

          {/* User Profile Card */}
          {user && (
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 font-bold ${
                    isAdmin
                      ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  }`}
                >
                  {isAdmin ? <Crown className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>

                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                    {user.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">
                      {isAdmin ? 'Yönetici' : 'Personel'}
                    </span>
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 uppercase shrink-0">
                      {user.companyCode || 'POLATLAR'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleNotificationClick}
                  className={`p-2 rounded-xl transition-all relative cursor-pointer ${
                    permission === 'granted'
                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                      : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 animate-pulse'
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
              </div>
            </div>
          )}

          {/* Logout Button */}
          {user && (
            <button
              onClick={() => {
                if (window.confirm('Oturumu kapatmak istediğinize emin misiniz?')) {
                  logout();
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-100 dark:border-red-950/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Güvenli Çıkış</span>
            </button>
          )}
        </div>
      </aside>

      {/* User Management Modal */}
      {isAdmin && (
        <UserManagementModal
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
        />
      )}

      {/* Create Company Modal (Only for Polatlar Admins) */}
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

      {/* Cari Listesi Modal */}
      <CariListModal
        isOpen={isCariListOpen}
        onClose={() => setIsCariListOpen(false)}
      />
    </>
  );
};
