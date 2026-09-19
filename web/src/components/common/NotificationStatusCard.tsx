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
  Lock,
  Zap,
  Edit2,
  Check,
  X,
  Trash2,
  Radio,
  Copy,
  Laptop,
} from 'lucide-react';
import { OneSignalService, SubscriptionDetails } from '../../services/oneSignalService';
import { DeviceService } from '../../services/deviceService';
import { RegisteredDevice, UserDeviceBinding } from '../../types/storage';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../types/auth';

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
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingDelayed, setIsSendingDelayed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [testSentMessage, setTestSentMessage] = useState<string | null>(null);

  // Device renaming inline state
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testingDeviceId, setTestingDeviceId] = useState<string | null>(null);

  // Anti-fraud device bindings state
  const [userBindings, setUserBindings] = useState<UserDeviceBinding[]>([]);
  const [isUnbindingId, setIsUnbindingId] = useState<string | null>(null);

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

  const loadDevices = async () => {
    try {
      const devs = await DeviceService.getRegisteredDevices();
      setRegisteredDevices(devs);
    } catch {
      // ignore
    }
  };

  const loadBindings = async () => {
    try {
      const list = await DeviceService.getUserDeviceBindings();
      setUserBindings(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStatus();
    loadDevices();
    loadBindings();

    // Listen to live push subscription changes
    const handleSubChanged = () => {
      loadStatus();
      loadDevices();
      loadBindings();
    };

    window.addEventListener('saha:push-subscription-changed', handleSubChanged);
    return () => {
      window.removeEventListener('saha:push-subscription-changed', handleSubChanged);
    };
  }, []);

  const handleResync = async () => {
    setIsLoading(true);
    setTestSentMessage(null);
    try {
      const data = await OneSignalService.selfHealSubscription(
        user ? { id: user.id, name: user.name, role: user.role } : undefined
      );
      setDetails(data);
      await loadDevices();
      await loadBindings();
      setTestSentMessage('🛡️ Cihaz ID, arka plan servisi ve donanım bağlantısı başarıyla güncellendi.');
    } catch (err) {
      console.error(err);
      setTestSentMessage('⚠️ Onarım sırasında bir sorun oluştu.');
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
            reg.showNotification('🔔 İş Takip Test Bildirimi', {
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
        title: '🔔 İş Takip Test Bildirimi',
        message: `${user.name}, bildirim sisteminiz aktif! Telefonunuz kilitliyken de donanım bildirimleri almaya devam edeceksiniz.`,
        targetMode: 'custom',
        targetUserIds: [user.id],
        targetSubscriptionIds: targetSubIds,
        url: 'https://saha-takip-beige.vercel.app',
        collapseId: `test_self_${Date.now()}`,
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
      await loadDevices();
    } catch (err: any) {
      console.error(err);
      setTestSentMessage(`❌ Test bildirimi gönderilirken bir sorun oluştu: ${err?.message || ''}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleDelayedLockScreenTest = async () => {
    if (!user) return;
    setIsSendingDelayed(true);
    setTestSentMessage(null);
    setCountdown(5);

    // 1. Ensure permission first
    if (details?.permission !== 'granted') {
      const granted = await OneSignalService.requestPermission({
        id: user.id,
        name: user.name,
        role: user.role,
      });
      if (!granted) {
        setTestSentMessage('⚠️ Lütfen önce tarayıcı bildirim iznini onaylayın.');
        setIsSendingDelayed(false);
        setCountdown(null);
        await loadStatus();
        return;
      }
    }

    // 2. UI countdown ticker
    let timeLeft = 5;
    const timer = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        clearInterval(timer);
        setCountdown(null);
      } else {
        setCountdown(timeLeft);
      }
    }, 1000);

    try {
      const targetSubIds = details?.subscriptionId ? [details.subscriptionId] : undefined;

      // 3. Send delayed push through serverless API proxy (Server waits 5s so device locking won't freeze it)
      const res = await OneSignalService.sendPushNotification({
        title: '🔒 İş Takip Kilitli Ekran Testi',
        message: `${user.name}, telefonunuz kilitliyken donanım push bildirimi başarıyla ulaştı!`,
        targetMode: 'custom',
        targetUserIds: [user.id],
        targetSubscriptionIds: targetSubIds,
        url: 'https://saha-takip-beige.vercel.app',
        delaySeconds: 5,
        collapseId: `test_lock_${Date.now()}`,
      });

      if (res && res.success) {
        setTestSentMessage(
          '✅ 5 saniyelik kilitli ekran bildirimi sunucudan tetiklendi! Telefonunuz kilitliyken ekranınızın uyanıp titreyeceğini gözlemleyin.'
        );
      } else {
        setTestSentMessage(`⚠️ Bildirim uyarısı: ${res?.error || 'Gönderim sırasında hata oluştu'}`);
      }
      await loadStatus();
      await loadDevices();
    } catch (err: any) {
      console.error(err);
      setTestSentMessage(`❌ Kilitli ekran testi hatası: ${err?.message || ''}`);
    } finally {
      setIsSendingDelayed(false);
    }
  };

  const handleSaveDeviceName = async (deviceId: string) => {
    if (!editingDeviceName.trim()) return;
    await DeviceService.setDeviceName(deviceId, editingDeviceName.trim());
    setEditingDeviceId(null);
    setEditingDeviceName('');
    await loadStatus();
    await loadDevices();
  };

  const handleCopyId = (idText: string) => {
    navigator.clipboard?.writeText(idText);
    setCopiedId(idText);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendTestToSpecificDevice = async (dev: RegisteredDevice) => {
    setTestingDeviceId(dev.deviceId);
    try {
      const binding = userBindings.find((b) => b.boundDeviceId === dev.deviceId);
      const targetIds: string[] = [];
      if (binding?.userId) targetIds.push(binding.userId);
      if (dev.userId && !dev.userId.startsWith('u_')) targetIds.push(dev.userId);
      if (dev.deviceId === currentDeviceId || targetIds.length === 0) {
        if (user?.id) targetIds.push(user.id);
      }

      const res = await OneSignalService.sendPushNotification({
        title: '📱 Cihaza Özel Test Bildirimi',
        message: `Merhaba! Bu bildirim "${dev.deviceName}" (${dev.deviceId}) cihazına özel olarak iletildi.`,
        targetMode: 'custom',
        targetUserIds: targetIds.length > 0 ? targetIds : (user?.id ? [user.id] : undefined),
        url: 'https://saha-takip-beige.vercel.app',
        collapseId: `test_dev_${dev.deviceId}`,
      });

      if (res && res.success) {
        alert(`✅ "${dev.deviceName}" cihazına test bildirimi gönderildi!`);
      } else {
        alert(`⚠️ Bildirim uyarısı: ${res?.error || 'Gönderilemedi'}`);
      }
    } catch (err: any) {
      alert(`Hata: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handleDeleteDevice = async (devId: string) => {
    if (confirm('Bu cihaz kaydını listeden silmek istediğinize emin misiniz?')) {
      await DeviceService.deleteDevice(devId);
      await loadDevices();
    }
  };

  const handleUnbindUser = async (userId: string, staffName: string) => {
    if (
      !confirm(
        `"${staffName}" kullanıcısının cihaz kilidini sıfırlamak istediğinize emin misiniz?\n\nPersonel yeni bir cihazdan giriş yaptığında yeni cihazı otomatik kilitlenecektir.`
      )
    ) {
      return;
    }
    setIsUnbindingId(userId);
    try {
      await DeviceService.unbindUserDevice(userId);
      await loadBindings();
      alert(`✅ "${staffName}" cihaz kilidi başarıyla sıfırlandı. Personel artık yeni telefonundan giriş yapabilir.`);
    } catch (e: any) {
      alert(`Kilit sıfırlanırken hata oluştu: ${e?.message || ''}`);
    } finally {
      setIsUnbindingId(null);
    }
  };

  const isPermissionGranted = details?.permission === 'granted';
  const currentDeviceId = details?.deviceId || DeviceService.getCurrentDeviceId();
  const currentDeviceName = details?.deviceName || DeviceService.getCurrentDeviceName(user?.name);

  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-slate-900 shadow-md overflow-hidden ${
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
              Bildirim & Cihaz Yönetimi
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              Cihaz kimlikleri (ID), kilit ekranı ve donanım bildirim takibi
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            loadStatus();
            loadDevices();
          }}
          disabled={isLoading}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Durumu Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Body Content */}
      <div className="space-y-4">
        {/* CURRENT DEVICE IDENTITY CARD */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                Bu Cihazın Kimliği
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                {currentDeviceId}
              </span>
              <button
                onClick={() => handleCopyId(currentDeviceId)}
                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                title="Cihaz ID'sini Kopyala"
              >
                {copiedId === currentDeviceId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-blue-100 dark:border-blue-900/40 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Cihaz Adı:</span>
              {editingDeviceId === currentDeviceId ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editingDeviceName}
                    onChange={(e) => setEditingDeviceName(e.target.value)}
                    className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-blue-400 text-xs font-bold text-slate-900 dark:text-slate-100"
                    placeholder="Cihaz Adı"
                  />
                  <button
                    onClick={() => handleSaveDeviceName(currentDeviceId)}
                    className="p-1 rounded bg-emerald-600 text-white"
                    title="Kaydet"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingDeviceId(null)}
                    className="p-1 rounded bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    title="İptal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <strong className="font-extrabold text-slate-900 dark:text-slate-100">
                    {currentDeviceName}
                  </strong>
                  <button
                    onClick={() => {
                      setEditingDeviceId(currentDeviceId);
                      setEditingDeviceName(currentDeviceName);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                    title="Cihaz Adını Düzenle"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Donanım Push Durumu:</span>
              {details?.subscriptionId ? (
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Bağlı ({details.subscriptionId.slice(0, 8)}...)</span>
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-amber-500">🟡 Beklemede</span>
                  <button
                    onClick={handleResync}
                    className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] shadow-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Şimdi Bağla
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Status Cards (4-Grid) */}
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
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Smartphone
                className={`w-5 h-5 shrink-0 ${
                  details?.subscriptionId ? 'text-emerald-500' : 'text-amber-500'
                }`}
              />
              <div className="min-w-0">
                <div className="text-slate-400 font-medium text-[10px]">Donanım Bağlantısı (ID)</div>
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {details?.subscriptionId
                    ? `🟢 Bağlı (${details.subscriptionId.slice(0, 8)}...)`
                    : '🟡 Beklemede'}
                </div>
              </div>
            </div>
            {!details?.subscriptionId && (
              <button
                onClick={handleResync}
                className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] shrink-0 active:scale-95 transition-all cursor-pointer"
              >
                İzin Ver & Bağla
              </button>
            )}
          </div>

          {/* Platform / Standalone PWA Card */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center gap-2.5">
            <Lock
              className={`w-5 h-5 shrink-0 ${
                details?.platform === 'ios'
                  ? details.isStandalone
                    ? 'text-emerald-500'
                    : 'text-amber-500'
                  : 'text-blue-500'
              }`}
            />
            <div className="min-w-0">
              <div className="text-slate-400 font-medium text-[10px]">Uygulama Modu (PWA)</div>
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {details?.platform === 'ios'
                  ? details.isStandalone
                    ? '🟢 iPhone (Ana Ekran Uygulaması)'
                    : '⚠️ iPhone (Safari Sekmesi)'
                  : details?.platform === 'android'
                  ? '🟢 Android Cihaz'
                  : '💻 Masaüstü'}
              </div>
            </div>
          </div>

          {/* Background Service Worker Card */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center gap-2.5">
            <Zap
              className={`w-5 h-5 shrink-0 ${
                details?.serviceWorkerActive ? 'text-emerald-500' : 'text-blue-500'
              }`}
            />
            <div className="min-w-0">
              <div className="text-slate-400 font-medium text-[10px]">Arka Plan Servisi</div>
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {details?.serviceWorkerActive ? '🟢 Çalışıyor (Kilitli Ekran Hazır)' : '🟢 Aktif'}
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
                {user.name} ({isUserAdmin(user) ? 'Yönetici' : 'Saha Yetkilisi'})
              </div>
            </div>
            <button
              onClick={handleResync}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shrink-0 active:scale-95 transition-all cursor-pointer"
              title="Aboneliği ve Servisi Onar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Onar & Yenile</span>
            </button>
          </div>
        )}

        {/* REGISTERED ALL DEVICES SECTION (2 iPhones, 1 Samsung, etc.) */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Sistemde Kayıtlı Cihazlar ({registeredDevices.length || 3} Cihaz)
              </h4>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              (2 iPhone, 1 Samsung & Yeni Cihazlar)
            </span>
          </div>

          <div className="space-y-2">
            {registeredDevices.length === 0 ? (
              <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                Bu cihaz kaydedildi. Diğer iPhone ve Samsung cihazlardan giriş yapıldıkça burada listelenecektir.
              </div>
            ) : (
              registeredDevices.map((dev) => {
                const isCurrent = dev.deviceId === currentDeviceId;
                return (
                  <div
                    key={dev.deviceId}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isCurrent
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        {dev.platform === 'ios' ? (
                          <Smartphone className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                        ) : dev.platform === 'android' ? (
                          <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Laptop className="w-4 h-4 text-blue-500" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="font-black text-slate-900 dark:text-slate-100 truncate">
                            {dev.deviceName || dev.deviceId}
                          </strong>
                          {isCurrent && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                              BU CİHAZ
                            </span>
                          )}
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {dev.deviceId}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Kullanıcı: {dev.userName}</span>
                          <span>•</span>
                          <span>
                            {dev.platform === 'ios'
                              ? 'iPhone'
                              : dev.platform === 'android'
                              ? 'Samsung/Android'
                              : 'Masaüstü'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Push status badge */}
                      {dev.pushStatus === 'connected' ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Bağlı</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Beklemede</span>
                        </span>
                      )}

                      {/* Direct Test Push Button */}
                      <button
                        onClick={() => handleSendTestToSpecificDevice(dev)}
                        disabled={testingDeviceId === dev.deviceId}
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                        title="Bu Cihaza Test Bildirimi Gönder"
                      >
                        <Send className="w-3 h-3" />
                        <span>{testingDeviceId === dev.deviceId ? '...' : 'Test'}</span>
                      </button>

                      {/* Delete button (only if not current) */}
                      {!isCurrent && (
                        <button
                          onClick={() => handleDeleteDevice(dev.deviceId)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                          title="Cihazı Listeden Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ANTI-FRAUD DEVICE LOCKS MANAGEMENT (Admin Only) */}
        {isUserAdmin(user) && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <h4 className="text-xs font-black text-rose-950 dark:text-rose-200 uppercase tracking-wider">
                  Personel Cihaz Kilitleri (Anti-Fraud Güvenliği)
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                Yetkisiz Giriş Engeli Aktif
              </span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Her personel yalnızca kendi kilitli telefonundan sisteme girebilir ve mesai başlatabilir/bitirebilir. Personel telefonunu değiştirdiğinde buradan kilidini sıfırlayabilirsiniz.
            </p>

            <div className="space-y-2">
              {userBindings.length === 0 ? (
                <div className="p-3 rounded-lg border border-dashed border-rose-200 dark:border-rose-900/40 text-center text-xs text-slate-500">
                  Henüz cihazına kilitlenmiş personel bulunmuyor. Personeller ilk kez giriş yaptıklarında kullandıkları cihazlar otomatik kilitlenecektir.
                </div>
              ) : (
                userBindings.map((binding) => (
                  <div
                    key={binding.userId}
                    className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="font-black text-slate-900 dark:text-slate-100">
                            {binding.userName || binding.username}
                          </strong>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            @{binding.username}
                          </span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center gap-1 border border-rose-200 dark:border-rose-800">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Kilitli</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            Cihaz: <strong className="text-slate-700 dark:text-slate-300">{binding.boundDeviceName}</strong>
                          </span>
                          <span>•</span>
                          <span className="font-mono">{binding.boundDeviceId}</span>
                          {binding.boundAt && (
                            <>
                              <span>•</span>
                              <span>
                                Kilit Tarihi:{' '}
                                {(() => {
                                  try {
                                    return new Date(binding.boundAt).toLocaleDateString('tr-TR');
                                  } catch {
                                    return '';
                                  }
                                })()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 self-end sm:self-center">
                      <button
                        onClick={() =>
                          handleUnbindUser(binding.userId, binding.userName || binding.username)
                        }
                        disabled={isUnbindingId === binding.userId}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/70 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Cihaz kilidini kaldır"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            isUnbindingId === binding.userId ? 'animate-spin' : ''
                          }`}
                        />
                        <span>
                          {isUnbindingId === binding.userId ? 'Sıfırlanıyor...' : '🔓 Kilidi Sıfırla'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Test Notification Action Box (Dual Test: Instant & 5s Locked Screen) */}
        <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Bildirim Donanım Testi</span>
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                Uygulama açıkken veya telefon kilitliyken donanım bildirimini test edin.
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Instant Test Button */}
              <button
                onClick={handleSendTestPush}
                disabled={isSendingTest || isSendingDelayed}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                title="Hemen açıkken test gönder"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSendingTest ? 'Gönderiliyor...' : 'Anlık Test'}</span>
              </button>

              {/* 5s Locked Screen Test Button */}
              <button
                onClick={handleDelayedLockScreenTest}
                disabled={isSendingTest || isSendingDelayed}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                title="5 saniye sonra ekran kilitliyken test gönder"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {countdown !== null
                    ? `Kilitleyin (${countdown}s)`
                    : isSendingDelayed
                    ? 'Tetikleniyor...'
                    : '⏱️ Kilitli Ekran Testi (5 Sn)'}
                </span>
              </button>
            </div>
          </div>

          {/* Countdown Prompt */}
          {countdown !== null && (
            <div className="p-3 rounded-lg bg-amber-500 text-white text-xs font-black animate-pulse flex items-center justify-between">
              <span>⏱️ Sayım başladı ({countdown} sn)! Lütfen telefonunuzu ŞİMDİ KİLİTLEYİN ve bekleyin!</span>
            </div>
          )}

          {testSentMessage && (
            <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 border border-emerald-300 dark:border-emerald-800">
              {testSentMessage}
            </div>
          )}
        </div>

        {/* iOS (iPhone) Specific Lock Screen Checklist */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-extrabold text-xs">
            <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>iPhone (iOS) Kilitli Ekran ve Kapalı Uygulama Ayarları:</span>
          </div>

          <div className="space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>1. Safari &gt; "Ana Ekrana Ekle" Durumu:</strong> Apple, kilitli ekranda bildirimi yalnızca Ana Ekrana eklenmiş PWA uygulamalarında destekler. Her iki cihazınızda da tamamlandı.
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>2. iOS Bildirim İzinleri:</strong> iPhone Ayarları &gt; <em>Bildirimler</em> &gt; <em>İş Takip</em> içerisinde <strong>"Kilitli Ekran"</strong>, <strong>"Bildirim Merkezi"</strong> ve <strong>"Sesler"</strong> seçeneklerinin işaretli olduğundan emin olun.
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong>3. Odak / Rahatsız Etmeyin:</strong> Telefonunuzda "Rahatsız Etmeyin" veya özel Odak modu açıksa, gelen kilitli ekran bildirimleri sessize alınabilir.
              </div>
            </div>
          </div>
        </div>

        {/* Android Persistent Settings Guide */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Android Cihazlarda Bildirimin Kesilmesini Önlemek İçin (Kalıcı Ayar):</span>
          </div>

          <div className="space-y-2 text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
            <div className="flex items-start gap-2">
              <Settings className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 font-bold">
                  1. "Uyg. kullanılmıyorsa izinleri kaldır" Ayarını KAPATIN:
                </strong>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  👉 <em>Ayarlar &gt; Uygulamalar &gt; İş Takip &gt; <strong>"Uyg. kullanılmıyorsa izinleri kaldır" anahtarını KAPATIN</strong>.</em>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <BatteryCharging className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 font-bold">
                  2. Pil Kısıtlaması & Uyku Modu:
                </strong>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  İş Takip pil ayarının <strong>"Kısıtlanmamış"</strong> olduğundan emin olun.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
