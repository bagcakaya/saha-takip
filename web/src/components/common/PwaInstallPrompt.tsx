import React, { useEffect, useState } from 'react';
import { Download, X, Bell, Smartphone, Share, PlusSquare } from 'lucide-react';
import { NotificationService } from '../../services/notificationService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  const [notificationState, setNotificationState] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Detect iOS Safari
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIos(isIosDevice);

      if ('Notification' in window) {
        setNotificationState(Notification.permission);
      }

      // Check if already in standalone (installed / Home Screen) mode
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      if (isStandalone) {
        setIsInstalled(true);
      }

      // Android/Chrome beforeinstallprompt event
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      window.addEventListener('appinstalled', () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      alert("Tarayıcınızın menüsünden (üç nokta) 'Uygulamayı Yükle' veya 'Ana Ekrana Ekle' seçeneğini belirleyebilirsiniz.");
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleEnableNotifications = async () => {
    if (isIos && !isInstalled) {
      alert("iPhone (iOS) cihazlarda bildirim alabilmek için önce uygulamayı 'Ana Ekrana Ekle'meniz gerekmektedir.");
      setShowIosGuide(true);
      return;
    }

    const granted = await NotificationService.requestPermission();
    if (granted) {
      setNotificationState('granted');
      NotificationService.sendNotification(
        '🔔 Bildirimler Aktif Edildi',
        'Yöneticinizin size ileteceği tüm notlar telefonunuza anında bildirim olarak düşecektir.'
      );
    } else {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotificationState(Notification.permission);
      }
    }
  };

  // If dismissed by user or already fully installed with notifications
  if (isDismissed) return null;
  if (isInstalled && notificationState === 'granted') return null;

  return (
    <>
      {/* 1. Main Install / Notification Prompt Banner */}
      <div className="fixed bottom-18 md:bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-40 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-xl border border-blue-500/40 rounded-3xl p-4 shadow-2xl text-white space-y-3 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
              {!isInstalled ? (
                <Smartphone className="w-5 h-5 text-white" />
              ) : (
                <Bell className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-white">
                {!isInstalled
                  ? isIos
                    ? 'iPhone: Ana Ekrana Ekle'
                    : 'Uygulamayı Telefona Yükle'
                  : 'Kilit Ekranı Bildirimleri'}
              </h4>
              <p className="text-[11px] text-slate-300 line-clamp-1">
                {!isInstalled
                  ? 'Uygulama olarak kullanıp bildirimleri almak için ekleyin.'
                  : 'Görev notlarını kilit ekranında almak için bildirimleri açın.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="text-slate-400 hover:text-white p-1 transition-colors"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isIos ? 'Nasıl Eklenir? (iPhone)' : 'Ana Ekrana Ekle'}</span>
            </button>
          )}

          {notificationState !== 'granted' && (
            <button
              onClick={handleEnableNotifications}
              className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                !isInstalled
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                  : 'flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Bildirimleri Aç</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. iOS Safari Step-by-Step Installation Modal Guide */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-bottom-5 duration-200 text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black">iPhone Ana Ekrana Ekleme</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <span className="font-bold block">Paylaş Butonuna Basın</span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    Safari'nin altındaki <Share className="w-3.5 h-3.5 text-blue-500 inline" /> simgesine dokunun.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <span className="font-bold block">Ana Ekrana Ekle'yi Seçin</span>
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                    Aşağı kaydırıp <PlusSquare className="w-3.5 h-3.5 text-blue-500 inline" /> <strong>"Ana Ekrana Ekle"</strong> seçeneğine dokunun.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <span className="font-bold block">Ekle'ye Dokunun</span>
                  <span className="text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Sağ üstteki <strong>"Ekle"</strong> butonuna basın. Uygulama artık ana ekranınızda hazır!
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/60">
              💡 <strong>Apple Güvenlik Notu:</strong> iPhone cihazlarda kilit ekranı bildirimleri, uygulama ana ekrana eklendikten sonra çalışmaktadır.
            </p>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
};
