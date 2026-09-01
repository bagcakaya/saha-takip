import React, { useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { Building2, StickyNote, ListTodo, LogOut, User, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserManagementModal } from '../auth/UserManagementModal';

export type TabType = 'installations' | 'notes' | 'template';

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

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo, Title and Subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icon.png"
              alt="Saha Takip Logo"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shadow-xs border border-slate-200/80 dark:border-slate-700 bg-white shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-widest uppercase text-blue-600 dark:text-blue-400 block truncate">
                {subtitle}
              </span>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight truncate leading-tight">
                {title}
              </h1>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
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
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <StickyNote className="w-4 h-4" />
              <span>Notlar</span>
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
