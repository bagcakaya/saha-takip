import React, { useEffect, useState } from 'react';
import {
  Building2,
  StickyNote,
  ListTodo,
  Users,
  LogOut,
  User as UserIcon,
  Crown,
  MapPin,
} from 'lucide-react';
import { TabType } from './Header';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { ThemeToggle } from './ThemeToggle';
import { UserManagementModal } from '../auth/UserManagementModal';
import { WeatherService } from '../../services/weatherService';
import { WeatherData } from '../../types/auth';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const { locations, notes } = useStorage();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

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

  const remindersCount = notes.filter((n) => n.reminderActive && n.reminderDate).length;

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

            {/* 2. Notlar & Hatırlatıcılar */}
            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-150 ${
                activeTab === 'notes'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <StickyNote className="w-4 h-4" />
                <span>Notlar & Hatırlatıcı</span>
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

            {/* 3. Şablon Yönetimi */}
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
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block truncate">
                    {isAdmin ? 'Sistem Yöneticisi' : 'Saha Yetkilisi'}
                  </span>
                </div>
              </div>

              <ThemeToggle />
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
    </>
  );
};
