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
} from 'lucide-react';
import { TabType } from '../components/layout/Header';
import { useStorage } from '../context/StorageContext';
import { useAuth } from '../context/AuthContext';
import { OneSignalService } from '../services/oneSignalService';
import { NotificationService } from '../services/notificationService';

interface HomeDashboardViewProps {
  onNavigate: (tab: TabType) => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { locations, notes, returnWarrantyItems, standardTasks, services } = useStorage();

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

  const isAdmin = user?.role === 'admin';
  const pendingReturns = returnWarrantyItems.filter((i) => i.status === 'pending').length;

  const todayStr = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-10 animate-in fade-in duration-300">
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

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
            <div className="px-3 sm:px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] font-bold text-slate-300 block uppercase">Aktif Kurulum</span>
              <span className="text-base sm:text-xl font-black text-white">{locations.length}</span>
            </div>
            <div className="px-3 sm:px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] font-bold text-slate-300 block uppercase">Servisler</span>
              <span className="text-base sm:text-xl font-black text-orange-400">{services.length}</span>
            </div>
            <div className="px-3 sm:px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] font-bold text-slate-300 block uppercase">İade / Garanti</span>
              <span className="text-base sm:text-xl font-black text-amber-400">{pendingReturns}</span>
            </div>
          </div>
        </div>

        {/* Decorative Background Blob */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -top-10 w-48 h-48 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
      </div>

      {/* Push Notification Status Alert (Shown if notifications are not enabled) */}
      {permission !== 'granted' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-300">
                Kilit Ekranı Bildirimleri Kapalı
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-800/90 dark:text-amber-400/90 leading-snug">
                Telefonunuz kilitliyken veya uygulama kapalıyken iş emirlerini anında alabilmek için bildirimleri aktif edin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestNotifications}
            className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-black shrink-0 shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <Bell className="w-4 h-4" />
            <span>Bildirimleri Aç</span>
          </button>
        </div>
      )}

      {/* Section Title */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
            Hızlı Erişim Modülleri
          </h3>
        </div>
        <span className="text-xs font-semibold text-slate-400">5 Ana Bölüm</span>
      </div>

      {/* The 5 Colorful Square Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5">
        {/* 1. Kurulumlar - Blue Gradient Square Card */}
        <button
          onClick={() => onNavigate('installations')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-5 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white border border-blue-400/30"
        >
          {/* Top Row: Icon and Badge */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {locations.length} Kayıt
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-sm sm:text-lg font-black tracking-tight flex items-center gap-1.5">
              <span>Kurulumlar</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[10px] sm:text-xs text-blue-100/90 font-medium line-clamp-2 leading-relaxed">
              Saha montajları, müşteri adresleri ve kontrol listeleri
            </p>
          </div>

          {/* Background Glow Element */}
          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>

        {/* 2. Servisler - Orange / Amber Gradient Square Card */}
        <button
          onClick={() => onNavigate('services')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-5 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-amber-500 via-orange-600 to-amber-700 text-white border border-amber-400/30"
        >
          {/* Top Row */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {services.length} Servis
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-sm sm:text-lg font-black tracking-tight flex items-center gap-1.5">
              <span>Servisler</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[10px] sm:text-xs text-amber-100/90 font-medium line-clamp-2 leading-relaxed">
              Müşteri servis müdahaleleri, parça ve yapılan iş kayıtları
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>

        {/* 3. İş Emirleri - Purple / Violet Gradient Square Card */}
        <button
          onClick={() => onNavigate('notes')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-5 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-900 text-white border border-purple-400/30"
        >
          {/* Top Row */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {notes.length} Emir
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-sm sm:text-lg font-black tracking-tight flex items-center gap-1.5">
              <span>İş Emirleri</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[10px] sm:text-xs text-purple-100/90 font-medium line-clamp-2 leading-relaxed">
              Personele görev atama, alarmlar ve anlık iş emirleri
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>

        {/* 4. İade / Garanti - Red Gradient Square Card */}
        <button
          onClick={() => onNavigate('returns')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-5 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-red-600 via-rose-700 to-rose-950 text-white border border-red-400/30"
        >
          {/* Top Row */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-white/25 text-white border border-white/30 backdrop-blur-xs">
              {pendingReturns} Süreçte
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-sm sm:text-lg font-black tracking-tight flex items-center gap-1.5">
              <span>İade / Garanti</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[10px] sm:text-xs text-rose-100/90 font-medium line-clamp-2 leading-relaxed">
              Seri no, kargo fişi ve 1 haftalık otomatik durum takibi
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>

        {/* 5. Şablon - Emerald / Teal Gradient Square Card */}
        <button
          onClick={() => onNavigate('template')}
          className="group relative aspect-square rounded-3xl p-4 sm:p-5 text-left flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 text-white border border-emerald-400/30 col-span-2 sm:col-span-1"
        >
          {/* Top Row */}
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner group-hover:rotate-6 transition-transform">
              <ListTodo className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-white/20 text-white border border-white/30 backdrop-blur-xs">
              {standardTasks.length} Görev
            </span>
          </div>

          {/* Bottom Content */}
          <div className="space-y-1 z-10">
            <h4 className="text-sm sm:text-lg font-black tracking-tight flex items-center gap-1.5">
              <span>Şablon</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h4>
            <p className="text-[10px] sm:text-xs text-emerald-100/90 font-medium line-clamp-2 leading-relaxed">
              Standart kontrol listesi görevleri & tam veri yedekleme
            </p>
          </div>

          <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
        </button>
      </div>
    </div>
  );
};
