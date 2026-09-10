import React from 'react';
import {
  Building2,
  ClipboardList,
  RotateCcw,
  ListTodo,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { TabType } from '../components/layout/Header';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';

interface HomeDashboardViewProps {
  onNavigate: (tab: TabType) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { locations, notes, returnWarrantyItems, standardTasks } = useStorage();

  const isAdmin = user?.role === 'admin';
  const pendingReturns = returnWarrantyItems.filter((i) => i.status === 'pending').length;

  const todayStr = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-24 md:pb-12 animate-in fade-in duration-300">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {isAdmin ? 'Sistem Yöneticisi' : 'Saha Yetkilisi'}
              </span>
              <span className="text-xs text-slate-400 capitalize">{todayStr}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Hoş Geldiniz, {user?.name || 'Yetkili'} 👋
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              İşlem yapmak istediğiniz bölüme aşağıdaki kare kutulardan doğrudan giriş yapabilirsiniz.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] font-bold text-slate-300 block uppercase">Aktif Kurulum</span>
              <span className="text-lg sm:text-xl font-black text-white">{locations.length}</span>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] font-bold text-slate-300 block uppercase">Bekleyen İade/Garanti</span>
              <span className="text-lg sm:text-xl font-black text-amber-400">{pendingReturns}</span>
            </div>
          </div>
        </div>

        {/* Decorative Background Blob */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 w-48 h-48 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
      </div>

      {/* Section Title */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
            Hızlı Erişim Modülleri
          </h3>
        </div>
        <span className="text-xs font-semibold text-slate-400">4 Ana Bölüm</span>
      </div>

      {/* The 4 Colorful Square Boxes (2x2 Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-5">
        {/* 1. Kurulumlar - Blue Gradient Square Card */}
        <button
          onClick={() => onNavigate('installations')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-6 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white border border-blue-400/30"
        >
          {/* Top Row: Icon and Badge */}
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {locations.length} Kayıt
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-1.5">
              <span>Kurulumlar</span>
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[11px] sm:text-xs text-blue-100/90 font-medium line-clamp-2 leading-relaxed">
              Saha montajları, müşteri adresleri ve kontrol listeleri
            </p>
          </div>

          {/* Background Glow Element */}
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>

        {/* 2. İş Emirleri - Purple / Violet Gradient Square Card */}
        <button
          onClick={() => onNavigate('notes')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-6 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-900 text-white border border-purple-400/30"
        >
          {/* Top Row */}
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {notes.length} Emir
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-1.5">
              <span>İş Emirleri</span>
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[11px] sm:text-xs text-purple-100/90 font-medium line-clamp-2 leading-relaxed">
              Personele görev atama, alarmlar ve anlık iş emirleri
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>

        {/* 3. İade / Garanti - Amber / Orange Gradient Square Card */}
        <button
          onClick={() => onNavigate('returns')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-6 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 text-white border border-amber-300/40"
        >
          {/* Top Row */}
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-white/25 text-white border border-white/30 backdrop-blur-xs">
              {pendingReturns} Süreçte
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-1.5">
              <span>İade / Garanti</span>
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[11px] sm:text-xs text-amber-100/90 font-medium line-clamp-2 leading-relaxed">
              Seri no, kargo fişi ve 1 haftalık otomatik durum takibi
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>

        {/* 4. Şablon - Emerald / Teal Gradient Square Card */}
        <button
          onClick={() => onNavigate('template')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-6 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 text-white border border-emerald-400/30"
        >
          {/* Top Row */}
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <ListTodo className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-black bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {standardTasks.length} Görev
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-base sm:text-xl font-black tracking-tight flex items-center gap-1.5">
              <span>Şablon</span>
              <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[11px] sm:text-xs text-emerald-100/90 font-medium line-clamp-2 leading-relaxed">
              Standart kontrol listesi görevleri & tam veri yedekleme
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>
      </div>
    </div>
  );
};
