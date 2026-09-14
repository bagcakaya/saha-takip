import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Send,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  BatteryCharging,
  Settings,
} from 'lucide-react';
import { OneSignalService, SubscriptionDetails } from '../../services/oneSignalService';
import { useAuth } from '../../context/AuthContext';

interface NotificationStatusCardProps {
  className?: string;
  isEmbedded?: boolean;
}

export const NotificationStatusCard: React.FC<NotificationStatusCardProps> = ({
  className = '',
  isEmbedded = false,
}) => {
  const { user } = useAuth();
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const data = await OneSignalService.getSubscriptionDetails();
      setDetails(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleResync = async () => {
    setIsLoading(true);
    try {
      await OneSignalService.requestPermission(
        user ? { id: user.id, name: user.name, role: user.role } : undefined
      );
      await loadStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!user) return;
    setIsSendingTest(true);
    setTestSentMessage(null);
    try {
      // 1. Ensure permission if not already granted
      if (details?.permission !== 'granted') {
        const granted = await OneSignalService.requestPermission({
          id: user.id,
          name: user.name,
          role: user.role,
        });
        if (!granted) {
          setTestSentMessage('⚠️ Lütfen önce tarayıcı bildirim iznini onaylayın.');
          setIsSendingTest(false);
          await loadStatus();
          return;
        }
      }

      // 2. Trigger instant local service worker notification for immediate foreground feedback
      if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            reg.showNotification('🔔 Saha Takip Test Bildirimi', {
              body: `${user.name}, bildirim sisteminiz telefonunuzda başarıyla aktif!`,
              icon: '/icon.png',
              badge: '/icon.png',
              vibrate: [200, 100, 200],
              tag: 'saha-takip-test',
            } as NotificationOptions);
          }
        } catch (e) {
          console.warn('Local service worker test notification notice:', e);
        }
      }

      // 3. Send remote hardware push notification via OneSignal REST API directly to this phone
      const targetSubIds = details?.subscriptionId ? [details.subscriptionId] : undefined;

      const res = await OneSignalService.sendPushNotification({
        title: '🔔 Saha Takip Test Bildirimi',
        message: `${user.name}, bildirim sisteminiz aktif! Telefonunuz kilitliyken de donanım bildirimleri almaya devam edeceksiniz.`,
        targetMode: 'custom',
        targetUserIds: [user.id],
        targetSubscriptionIds: targetSubIds,
        url: 'https://saha-takip-beige.vercel.app',
      });

      console.log('Test push notification response:', res);

      if (res && res.success) {
        setTestSentMessage(
          '✅ Test bildirimi telefonunuza gönderildi! Üst bildirim çubuğunu çekerek veya ekranı kilitleyerek görebilirsiniz.'
        );
      } else {
        setTestSentMessage(`⚠️ Bildirim uyarısı: ${res?.error || 'Gönderim sırasında hata oluştu'}`);
      }

      await loadStatus();
    } catch (err: any) {
      console.error(err);
      setTestSentMessage(`❌ Test bildirimi gönderilirken bir sorun oluştu: ${err?.message || ''}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const isPermissionGranted = details?.permission === 'granted';

  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-slate-850 shadow-md overflow-hidden ${
        isEmbedded
          ? 'border-slate-200/90 dark:border-slate-700/80 p-4 sm:p-5'
          : 'border-slate-200 dark:border-slate-700 p-5'
      } ${className}`}
    >
      {/* Header section */}
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
              Bildirim Ayarları
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Kilit ekranı bildirimlerinin kalıcı ve kesintisiz çalışmasını sağlar
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={isLoading}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Durumu Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Body Content */}
      <div className="space-y-3.5">
        {/* Live Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {/* Permission Card */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center gap-2.5">
            <ShieldCheck
              className={`w-5 h-5 shrink-0 ${
                isPermissionGranted ? 'text-emerald-500' : 'text-amber-500'
              }`}
            />
            <div className="min-w-0">
              <div className="text-slate-400 font-medium text-[10px]">Tarayıcı İzni</div>
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {isPermissionGranted ? '🟢 İzin Verildi' : '⚠️ İzin Verilmedi'}
              </div>
            </div>
          </div>

          {/* Connection Card */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center gap-2.5">
            <Smartphone
              className={`w-5 h-5 shrink-0 ${
                details?.subscriptionId ? 'text-emerald-500' : 'text-amber-500'
              }`}
            />
            <div className="min-w-0">
              <div className="text-slate-400 font-medium text-[10px]">Cihaz Bağlantısı</div>
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {details?.subscriptionId
                  ? `🟢 Bağlı (${details.subscriptionId.slice(0, 8)}...)`
                  : '🟡 Beklemede'}
              </div>
            </div>
          </div>
        </div>

        {/* User Pairing Box */}
        {user && (
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 flex items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5">
              <div className="text-blue-600 dark:text-blue-400 font-bold">
                Aktif Bildirim Alıcısı:
              </div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {user.name} ({user.role === 'admin' ? 'Yönetici' : 'Saha Yetkilisi'})
              </div>
            </div>
            <button
              onClick={handleResync}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shrink-0 active:scale-95 transition-all"
              title="Aboneliği Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
          </div>
        )}

        {/* Test Notification Action */}
        <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Kilit Ekranı Testi</span>
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                Telefonunuza anında donanım bildirimi göndererek sistemi test edin.
              </div>
            </div>

            <button
              onClick={handleSendTestPush}
              disabled={isSendingTest}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-xs transition-all disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSendingTest
                  ? 'Gönderiliyor...'
                  : !isPermissionGranted
                  ? 'İzin Ver & Test Gönder'
                  : 'Test Gönder'}
              </span>
            </button>
          </div>

          {testSentMessage && (
            <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 border border-emerald-300 dark:border-emerald-800">
              {testSentMessage}
            </div>
          )}
        </div>

        {/* Android Persistent Settings Guide */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Birkaç Gün Sonra Bildirimin Kesilmesini Önlemek İçin (Kalıcı Ayar):</span>
          </div>

          <div className="space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
            {/* Step 1: Remove permissions if unused */}
            <div className="flex items-start gap-2">
              <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 font-bold">
                  1. "Uyg. kullanılmıyorsa izinleri kaldır" Ayarını KAPATIN:
                </strong>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  Telefon ayarlarınızda bu seçenek <strong>AÇIK</strong> olduğunda, Android 2-3 gün uygulamaya girilmediğinde bildirim izinlerini otomatik sıfırlar ve uygulamayı uykuya alır.
                  <br />
                  👉 <em>Ayarlar &gt; Uygulamalar &gt; Saha Takip &gt; <strong>"Uyg. kullanılmıyorsa izinleri kaldır" anahtarını KAPATIN</strong>.</em>
                </p>
              </div>
            </div>

            {/* Step 2: Battery Unrestricted */}
            <div className="flex items-start gap-2">
              <BatteryCharging className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 font-bold">
                  2. Pil Kısıtlaması & Chrome Uyku Modu:
                </strong>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  Saha Takip pil ayarının <strong>"Kısıtlanmamış"</strong> olduğundan ve tarayıcınızın (Google Chrome) telefonun "Derin Uykudaki Uygulamalar" listesinde olmadığından emin olun.
                </p>
              </div>
            </div>

            {/* Step 3: Background Data */}
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 font-bold">
                  3. Arka Plan Veri İzni:
                </strong>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  Mobil Veri &gt; <strong>"Arka plan veri kullanımına izin ver"</strong> seçeneğinin açık olduğundan emin olun.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
