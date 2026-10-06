import { StorageService } from './storageService';
import { OneSignalService } from './oneSignalService';
import { LocationService } from './locationService';
import { AttendanceRecord } from '../types/storage';

export type ActionType = 'SYNC_ATTENDANCE' | 'SEND_PUSH' | 'SCHEDULE_BREAK' | 'CANCEL_PUSH';

export interface QueuedAction {
  id: string;
  type: ActionType;
  companyCode: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  payload: any;
}

const QUEUE_STORAGE_PREFIX = '@fast_action_queue_';
const MAX_ATTEMPTS = 5;

let activeCompany = 'POLATLAR';
let isRunning = false;
let isProcessing = false;
let heartbeatInterval: any = null;

function generateActionId(): string {
  return 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function getStorageKey(compCode: string): string {
  return `${QUEUE_STORAGE_PREFIX}${(compCode || activeCompany || 'POLATLAR').toUpperCase()}`;
}

function loadPersistedQueue(compCode: string): QueuedAction[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(compCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[Ön Hazırlık & Kuyruk Ajanı] Kuyruk okunamadı:', e);
    return [];
  }
}

function savePersistedQueue(compCode: string, queue: QueuedAction[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(compCode), JSON.stringify(queue));
  } catch (e) {
    console.warn('[Ön Hazırlık & Kuyruk Ajanı] Kuyruk kaydedilemedi:', e);
  }
}

export const FastActionAgent = {
  /**
   * Ön Hazırlık & Kuyruk Ajanını Başlatır (Client-Side Background Worker)
   * 1. GPS uydularını ve konum önbelleğini arka planda sürekli ısıtır (0ms refleks).
   * 2. İnternet ve sekme odak durumunu dinler.
   * 3. Bekleyen arka plan senkronizasyon kuyruğunu başlatır.
   */
  start(companyCode: string = 'POLATLAR'): void {
    activeCompany = (companyCode || 'POLATLAR').toUpperCase();
    if (isRunning) return;
    isRunning = true;

    console.log(`[Ön Hazırlık & Kuyruk Ajanı] Başlatıldı (${activeCompany}). GPS ve kuyruk uyanık.`);

    // 1. Konum Ön Hazırlığı (GPS Watch)
    LocationService.startPrewarming();

    // 2. Çevrimdışı / Çevrimiçi dinleyicileri
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkRecovery);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // 3. Kalp Atışı (Heartbeat - Her 6 saniyede kuyruk kontrolü)
    if (!heartbeatInterval) {
      heartbeatInterval = setInterval(() => {
        this.processQueue();
      }, 6000);
    }

    // Başlangıçta bekleyen görevleri anında erit
    setTimeout(() => {
      this.processQueue();
    }, 1000);
  },

  /**
   * Ajanı Durdurur
   */
  stop(): void {
    isRunning = false;
    LocationService.stopPrewarming();
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkRecovery);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    console.log('[Ön Hazırlık & Kuyruk Ajanı] Durduruldu.');
  },

  /**
   * İnternet geri geldiğinde kuyruktaki tüm işlemleri derhal sunucuya boşaltır
   */
  handleNetworkRecovery: (): void => {
    console.log('[Ön Hazırlık & Kuyruk Ajanı] 🌐 İnternet bağlantısı sağlandı. Kuyruk boşaltılıyor...');
    FastActionAgent.processQueue();
  },

  /**
   * Kullanıcı uygulamaya döndüğünde GPS ön hazırlığını ve kuyruğu canlandırır
   */
  handleVisibilityChange: (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      LocationService.startPrewarming();
      FastActionAgent.processQueue();
    }
  },

  /**
   * ⚡ Mesai / Mola Değişikliğini Kuyruğa Ekler (0ms UI Refleksi)
   * UI beklemez; kuyruk arka planda Supabase Pro ve Yerel MSSQL sunucuya yazar.
   * Aynı kurum için bekleyen eski SYNC varsa yeni veriyle birleştirip tek pakette gönderir (Dedup).
   */
  enqueueAttendanceSync(companyCode: string, records: AttendanceRecord[]): void {
    const comp = (companyCode || activeCompany).toUpperCase();
    const queue = loadPersistedQueue(comp);

    // Dedup: Eğer kuyrukta henüz işlenmemiş bir SYNC_ATTENDANCE varsa onu en güncel liste ile yenile
    const existingIndex = queue.findIndex((q) => q.type === 'SYNC_ATTENDANCE');
    if (existingIndex !== -1) {
      queue[existingIndex].payload = { records };
      queue[existingIndex].createdAt = Date.now();
    } else {
      queue.push({
        id: generateActionId(),
        type: 'SYNC_ATTENDANCE',
        companyCode: comp,
        createdAt: Date.now(),
        attempts: 0,
        payload: { records },
      });
    }

    savePersistedQueue(comp, queue);

    // Arka planda asenkron işlemeyi tetikle (UI kilitlenmez!)
    setTimeout(() => {
      this.processQueue();
    }, 10);
  },

  /**
   * 📢 OneSignal Anlık Push Bildirimini Kuyruğa Ekler
   */
  enqueuePushNotification(params: {
    title: string;
    message: string;
    targetMode?: 'admin' | 'staff' | 'all' | 'custom';
    targetUserIds?: string[];
    excludeUserIds?: string[];
    companyCode?: string;
    url?: string;
    collapseId?: string;
  }): void {
    const comp = (params.companyCode || activeCompany).toUpperCase();
    const queue = loadPersistedQueue(comp);

    queue.push({
      id: generateActionId(),
      type: 'SEND_PUSH',
      companyCode: comp,
      createdAt: Date.now(),
      attempts: 0,
      payload: params,
    });

    savePersistedQueue(comp, queue);

    setTimeout(() => {
      this.processQueue();
    }, 10);
  },

  /**
   * ⏰ Mola Bitiş Bulut Alarmını Kuyruğa Ekler (OneSignal Sunucu Zamanlaması)
   */
  enqueueScheduleBreakPush(params: {
    userId: string;
    userName?: string;
    targetIsoDate: string;
    breakMinutes: number;
    companyCode: string;
  }): void {
    const comp = (params.companyCode || activeCompany).toUpperCase();
    const queue = loadPersistedQueue(comp);

    queue.push({
      id: generateActionId(),
      type: 'SCHEDULE_BREAK',
      companyCode: comp,
      createdAt: Date.now(),
      attempts: 0,
      payload: params,
    });

    savePersistedQueue(comp, queue);

    setTimeout(() => {
      this.processQueue();
    }, 10);
  },

  /**
   * 🚫 Zamanlanmış Bildirimi İptal Etme Görevini Kuyruğa Ekler
   */
  enqueueCancelNotification(notificationId: string, companyCode?: string): void {
    if (!notificationId) return;
    const comp = (companyCode || activeCompany).toUpperCase();
    const queue = loadPersistedQueue(comp);

    queue.push({
      id: generateActionId(),
      type: 'CANCEL_PUSH',
      companyCode: comp,
      createdAt: Date.now(),
      attempts: 0,
      payload: { notificationId },
    });

    savePersistedQueue(comp, queue);

    setTimeout(() => {
      this.processQueue();
    }, 10);
  },

  /**
   * ⚙️ Kuyruktaki Görevleri Arka Planda Sırayla ve Garantili İşler
   */
  async processQueue(): Promise<void> {
    if (isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Çevrimdışıysa beklet, internet gelince handleNetworkRecovery tetiklenecek
      return;
    }

    const comp = activeCompany;
    const queue = loadPersistedQueue(comp);
    if (queue.length === 0) return;

    isProcessing = true;

    try {
      const remaining: QueuedAction[] = [];

      for (const action of queue) {
        // Exponential backoff: Eğer daha önce hata almışsa bekleme süresini kontrol et
        if (action.attempts > 0 && action.lastAttemptAt) {
          const waitTime = Math.min(60000, 1500 * Math.pow(2, action.attempts));
          if (Date.now() - action.lastAttemptAt < waitTime) {
            remaining.push(action);
            continue;
          }
        }

        try {
          if (action.type === 'SYNC_ATTENDANCE') {
            await StorageService.saveAttendanceRecords(action.payload.records);
          } else if (action.type === 'SEND_PUSH') {
            await OneSignalService.sendPushNotification(action.payload);
          } else if (action.type === 'SCHEDULE_BREAK') {
            await OneSignalService.scheduleBreakOverPush(action.payload);
          } else if (action.type === 'CANCEL_PUSH') {
            await OneSignalService.cancelNotification(action.payload.notificationId);
          }

          // Başarılı: Görev tamamlandı, kuyruktan silinir (remaining'e eklenmez)
        } catch (err: any) {
          console.warn(`[Ön Hazırlık & Kuyruk Ajanı] Görev ${action.type} başarısız oldu:`, err);
          action.attempts += 1;
          action.lastAttemptAt = Date.now();

          if (action.attempts < MAX_ATTEMPTS) {
            remaining.push(action);
          } else {
            console.error(`[Ön Hazırlık & Kuyruk Ajanı] Görev ${action.type} ${MAX_ATTEMPTS} denemede tamamlanamadı, kuyruktan düşürüldü.`);
          }
        }
      }

      savePersistedQueue(comp, remaining);
    } finally {
      isProcessing = false;
    }
  },

  /**
   * Kuyruk ve Ön Hazırlık Durumunu Raporlar
   */
  getStatus(): {
    isRunning: boolean;
    pendingTasksCount: number;
    isPrewarming: boolean;
    hasWarmPosition: boolean;
    warmPositionAccuracy?: number | null;
  } {
    const queue = loadPersistedQueue(activeCompany);
    const warmPos = LocationService.getCachedPosition();
    return {
      isRunning,
      pendingTasksCount: queue.length,
      isPrewarming: LocationService.isPrewarming(),
      hasWarmPosition: !!warmPos,
      warmPositionAccuracy: warmPos?.accuracy,
    };
  },
};
