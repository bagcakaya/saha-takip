import React, { useEffect, useState } from 'react';
import { Download, X, Bell, Smartphone } from 'lucide-react';
import { NotificationService } from '../../services/notificationService';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const [notificationState, setNotificationState] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('Notification' in window) {
        setNotificationState(Notification.permission);
      }

      // Check if already in standalone (installed) mode
      if (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      ) {
        setIsInstalled(true);
      }

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsInstallable(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);

      window.addEventListener('appinstalled', () => {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleEnableNotifications = async () => {
    const granted = await NotificationService.requestPermission();
    if (granted) {
      setNotificationState('granted');
      NotificationService.sendNotification(
        '🔔 Bildirimler Aktif Edildi',
        'Yöneticinizin size ileteceği tüm notlar telefonunuza anında bildirim olarak düşecektir.'
      );
    } else {
      setNotificationState(Notification.permission);
    }
  };

  // If dismissed by user or already fully configured
  if (isDismissed) return null;

  // If already installed and notifications are already active
  if (isInstalled && notificationState === 'granted') return null;

  // If not installable and notifications already handled
  if (!isInstallable && (notificationState === 'granted' || notificationState === 'denied')) {
    return null;
  }

  return (
    <div className="fixed bottom-18 md:bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-40 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-xl border border-blue-500/40 rounded-3xl p-4 shadow-2xl text-white space-y-3 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
            {isInstallable && !isInstalled ? (
              <Smartphone className="w-5 h-5 text-white" />
            ) : (
              <Bell className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-black text-white">
              {isInstallable && !isInstalled ? 'Uygulamayı Telefona Yükle' : 'Kilit Ekranı Bildirimleri'}
            </h4>
            <p className="text-[11px] text-slate-300 line-clamp-1">
              {isInstallable && !isInstalled
                ? 'Ana ekrana ekleyip mobil uygulama gibi kullanın.'
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
        {isInstallable && !isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ana Ekrana Ekle</span>
          </button>
        )}

        {notificationState !== 'granted' && (
          <button
            onClick={handleEnableNotifications}
            className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              isInstallable && !isInstalled
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
  );
};
