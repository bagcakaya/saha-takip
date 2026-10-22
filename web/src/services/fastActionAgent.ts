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
let selfHealInterval: any = null;
let lastSelfHealAt = 0;

function generateActionId(): string {
  return 'act_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function getStorageKey(compCode: string): string {
  return `${QUEUE_STORAGE_PREFIX}${(compCode || activeCompany || 'POLATLAR').toUpperCase()}`;
}

function getAllQueueCompanyCodes(): string[] {
  const codes = new Set<string>([activeCompany || 'POLATLAR']);
  if (typeof localStorage !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(QUEUE_STORAGE_PREFIX)) {
          const comp = key.slice(QUEUE_STORAGE_PREFIX.length).trim().toUpperCase();
          if (comp) codes.add(comp);
        }
      }
    } catch {}
  }
  return Array.from(codes);
}

function triggerSelfHealIfNeeded(force = false): void {
  const now = Date.now();
  if (!force && now - lastSelfHealAt < 60000) return;
  lastSelfHealAt = now;
  try {
    OneSignalService.selfHealSubscription().catch(() => {});
  } catch {}
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
    if (isRunning) {
      setTimeout(() => {
        this.processQueue();
      }, 50);
      return;
    }
    isRunning = true;

    console.log(`[Ön Hazırlık & Kuyruk Ajanı] Başlatıldı (${activeCompany}). GPS, OneSignal Self-Heal ve kuyruk uyanık.`);

    // 1. Konum Ön Hazırlığı (GPS Watch)
    LocationService.startPrewarming();

    // 2. OneSignal Bildirim Aboneliği Canlandırma (Self-Heal)
    triggerSelfHealIfNeeded(true);

    // 3. Çevrimdışı / Çevrimiçi dinleyicileri
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkRecovery);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // 4. Kalp Atışı (Heartbeat - Her 5 saniyede kuyruk kontrolü)
    if (!heartbeatInterval) {
      heartbeatInterval = setInterval(() => {
        this.processQueue();
      }, 5000);
    }

    // 5. Periyodik OneSignal Abonelik & Etiket Senkronizasyonu (Her 90 saniyede bir)
    if (!selfHealInterval) {
      selfHealInterval = setInterval(() => {
        triggerSelfHealIfNeeded(false);
      }, 90000);
    }

    // Başlangıçta bekleyen görevleri anında erit
    setTimeout(() => {
      this.processQueue();
    }, 300);
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
    if (selfHealInterval) {
      clearInterval(selfHealInterval);
      selfHealInterval = null;
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
    triggerSelfHealIfNeeded(true);
    FastActionAgent.processQueue();
  },

  /**
   * Kullanıcı uygulamaya döndüğünde GPS ön hazırlığını, bildirim aboneliğini ve kuyruğu canlandırır
   */
  handleVisibilityChange: (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      LocationService.startPrewarming();
      triggerSelfHealIfNeeded(false);
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
    breakId?: string;
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

    const companyCodes = getAllQueueCompanyCodes();
    isProcessing = true;

    try {
      for (const comp of companyCodes) {
        const initialQueue = loadPersistedQueue(comp);
        if (initialQueue.length === 0) continue;

        // Push ve mola zamanlama görevlerini yavaş veritabanı senkronizasyonunun önüne al
        const sortedQueue = [...initialQueue].sort((a, b) => {
          const priority = (t: ActionType) =>
            t === 'SCHEDULE_BREAK' || t === 'CANCEL_PUSH' ? 0 : t === 'SEND_PUSH' ? 1 : 2;
          return priority(a.type) - priority(b.type);
        });

        const completedIds = new Set<string>();
        const updatedMap = new Map<string, QueuedAction>();

        for (const action of sortedQueue) {
          // Exponential backoff: Eğer daha önce hata almışsa bekleme süresini kontrol et
          if (action.attempts > 0 && action.lastAttemptAt) {
            const waitTime = Math.min(30000, 1200 * Math.pow(2, action.attempts));
            if (Date.now() - action.lastAttemptAt < waitTime) {
              updatedMap.set(action.id, action);
              continue;
            }
          }

          try {
            if (action.type === 'SYNC_ATTENDANCE') {
              await StorageService.saveAttendanceRecords(action.payload.records);
            } else if (action.type === 'SEND_PUSH') {
              const pushRes = await OneSignalService.sendPushNotification(action.payload);
              if (!pushRes || !pushRes.success) {
                throw new Error(pushRes?.error || 'OneSignal push gönderimi başarısız oldu.');
              }
            } else if (action.type === 'SCHEDULE_BREAK') {
              const schedId = await OneSignalService.scheduleBreakOverPush(action.payload);
              if (!schedId) {
                throw new Error('OneSignal mola bitiş bildirimi zamanlanamadı.');
              }
            } else if (action.type === 'CANCEL_PUSH') {
              await OneSignalService.cancelNotification(action.payload.notificationId);
            }

            // Başarılı: Görev tamamlandı
            completedIds.add(action.id);
          } catch (err: any) {
            console.warn(`[Ön Hazırlık & Kuyruk Ajanı] Görev ${action.type} (${comp}) başarısız oldu:`, err);
            action.attempts += 1;
            action.lastAttemptAt = Date.now();

            if (action.attempts < MAX_ATTEMPTS) {
              updatedMap.set(action.id, action);
            } else {
              completedIds.add(action.id);
              console.error(
                `[Ön Hazırlık & Kuyruk Ajanı] Görev ${action.type} ${MAX_ATTEMPTS} denemede tamamlanamadı, kuyruktan düşürüldü.`
              );
            }
          }
        }

        // İşlem sürerken kuyruğa yeni eklenen görevleri ASLA ezme!
        const latestQueue = loadPersistedQueue(comp);
        const mergedRemaining: QueuedAction[] = [];
        for (const item of latestQueue) {
          if (completedIds.has(item.id)) continue;
          if (updatedMap.has(item.id)) {
            mergedRemaining.push(updatedMap.get(item.id)!);
          } else {
            mergedRemaining.push(item);
          }
        }

        savePersistedQueue(comp, mergedRemaining);
      }
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
