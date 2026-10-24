import { SystemLogItem, SystemLogLevel, SystemLogCategory } from '../types/storage';
import { supabase } from './supabaseClient';
import { ServerConfigService } from './serverConfigService';

const SYSTEM_LOGS_LOCAL_KEY = '@is_takip_system_logs';
const MAX_LOCAL_LOGS = 300;
const MAX_CLOUD_LOGS = 500;
const SLOT_ID = 13; // Slot 13 reserved for system & error logs

class SystemLoggerService {
  private isSyncing = false;
  private syncTimeout: any = null;
  private isAutoCaptureRegistered = false;

  private currentUserContext: {
    userId?: string;
    userName?: string;
    userRole?: string;
    companyCode?: string;
  } = {};

  constructor() {
    this.initAutoCapture();
  }

  /**
   * Set user context for subsequent logs
   */
  public setUserContext(user: { id?: string; name?: string; role?: string; companyCode?: string } | null) {
    if (user) {
      this.currentUserContext = {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        companyCode: user.companyCode,
      };
    } else {
      this.currentUserContext = {};
    }
  }

  /**
   * Auto capture window unhandled errors and promise rejections
   */
  public initAutoCapture() {
    if (typeof window === 'undefined' || this.isAutoCaptureRegistered) return;
    this.isAutoCaptureRegistered = true;

    window.addEventListener('error', (event) => {
      const msg = event.message || 'Bilinmeyen JavaScript Hatası';
      const file = event.filename ? ` (${event.filename}:${event.lineno})` : '';
      const stack = event.error?.stack || '';
      this.error('SISTEM_GENEL', `${msg}${file}`, stack);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || 'Unhandled Promise Rejection');
      // iOS Safari WebKit / OneSignal IndexedDB arka plan iç uyarısını yoksay
      if (msg.includes('Attempt to delete range from database without an in-progress transaction')) {
        return;
      }
      if (msg.includes('User denied Geolocation')) {
        this.warn('GPS_KONUM', 'Cihazda konum (GPS) izni reddedildi veya kapalı.');
        return;
      }
      const stack = reason?.stack || '';
      this.error('SISTEM_GENEL', `Beklenmeyen Asenkron Hata: ${msg}`, stack);
    });
  }

  /**
   * Format date as 'YYYY-MM-DD HH:mm:ss'
   */
  private formatDate(date: Date = new Date()): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }

  /**
   * Get device information summary
   */
  private getDeviceInfo(): string {
    if (typeof navigator === 'undefined') return 'Sunucu / Bilinmiyor';
    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(ua);
    const screenInfo = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
    const online = navigator.onLine ? 'Online' : 'Offline';
    return `${isMobile ? 'Mobil' : 'Masaüstü'} [${screenInfo}] (${online}) - ${ua.slice(0, 100)}`;
  }

  /**
   * Base log recording method
   */
  public log(
    level: SystemLogLevel,
    category: SystemLogCategory,
    message: string,
    details?: string | any,
    overrideUser?: { userId?: string; userName?: string; userRole?: string; companyCode?: string }
  ): SystemLogItem {
    const now = Date.now();
    const dateStr = this.formatDate(new Date(now));

    let detailsStr: string | undefined;
    if (details !== undefined && details !== null) {
      if (typeof details === 'string') {
        detailsStr = details;
      } else if (details instanceof Error) {
        detailsStr = `${details.message}\nStack: ${details.stack || 'Yok'}`;
      } else {
        try {
          detailsStr = JSON.stringify(details, null, 2);
        } catch {
          detailsStr = String(details);
        }
      }
    }

    const user = overrideUser || this.currentUserContext;

    const item: SystemLogItem = {
      id: `log_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      dateStr,
      level,
      category,
      message,
      details: detailsStr,
      userId: user.userId,
      userName: user.userName,
      userRole: user.userRole,
      companyCode: (user.companyCode || 'POLATLAR').toUpperCase(),
      deviceInfo: this.getDeviceInfo(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Console output with styling
    const color = level === 'ERROR' ? '#ef4444' : level === 'WARN' ? '#f59e0b' : '#3b82f6';
    console.log(
      `%c[İş Takip Log - ${level}] [${category}] ${dateStr}: ${message}`,
      `color: ${color}; font-weight: bold;`
    );
    if (detailsStr) {
      console.log(`Detay:`, detailsStr);
    }

    // Save to local buffer
    this.appendLocalLog(item);

    // Forward to local API server if available (Direct File Append to C:\Users\Mert\Desktop\Görev_Tamamlama\Logs\is_takip_hatalari.log)
    this.sendToLocalServer(item).catch(() => {});

    // Schedule batch cloud sync to Supabase slot 13
    this.scheduleCloudSync();

    return item;
  }

  public error(category: SystemLogCategory, message: string, details?: string | any, user?: any) {
    return this.log('ERROR', category, message, details, user);
  }

  public warn(category: SystemLogCategory, message: string, details?: string | any, user?: any) {
    return this.log('WARN', category, message, details, user);
  }

  public info(category: SystemLogCategory, message: string, details?: string | any, user?: any) {
    return this.log('INFO', category, message, details, user);
  }

  /**
   * Append to localStorage buffer
   */
  private appendLocalLog(item: SystemLogItem) {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(SYSTEM_LOGS_LOCAL_KEY);
      let logs: SystemLogItem[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(logs)) logs = [];

      logs.unshift(item);
      if (logs.length > MAX_LOCAL_LOGS) {
        logs = logs.slice(0, MAX_LOCAL_LOGS);
      }
      localStorage.setItem(SYSTEM_LOGS_LOCAL_KEY, JSON.stringify(logs));
    } catch (err) {
      console.warn('[SystemLogger] LocalStorage log append failed:', err);
    }
  }

  /**
   * Get all local logs
   */
  public getLocalLogs(): SystemLogItem[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(SYSTEM_LOGS_LOCAL_KEY);
      if (!raw) return [];
      const logs = JSON.parse(raw);
      return Array.isArray(logs) ? logs : [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch all logs (merged from local and cloud slot 13)
   */
  public async fetchAllLogs(): Promise<SystemLogItem[]> {
    const local = this.getLocalLogs();
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', SLOT_ID)
        .maybeSingle();

      if (error || !data || !Array.isArray(data.tasks)) {
        return local;
      }

      let cloudLogs: SystemLogItem[] = [];
      try {
        const fullJson = data.tasks.join('');
        const parsed = JSON.parse(fullJson);
        if (Array.isArray(parsed)) {
          cloudLogs = parsed;
        }
      } catch {}

      // Merge and deduplicate by id
      const map = new Map<string, SystemLogItem>();
      for (const item of local) {
        if (item && item.id) map.set(item.id, item);
      }
      for (const item of cloudLogs) {
        if (item && item.id) map.set(item.id, item);
      }

      const merged = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return merged;
    } catch {
      return local;
    }
  }

  /**
   * Schedule cloud sync with debounce
   */
  private scheduleCloudSync() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncCloudLogs().catch(() => {});
    }, 150);
  }

  /**
   * Sync logs to Supabase slot 13
   */
  private async syncCloudLogs() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const localLogs = this.getLocalLogs();
      if (localLogs.length === 0) return;

      const { data } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', SLOT_ID)
        .maybeSingle();

      let cloudLogs: SystemLogItem[] = [];
      if (data && Array.isArray(data.tasks)) {
        try {
          const fullJson = data.tasks.join('');
          const parsed = JSON.parse(fullJson);
          if (Array.isArray(parsed)) cloudLogs = parsed;
        } catch {}
      }

      const map = new Map<string, SystemLogItem>();
      for (const l of cloudLogs) if (l && l.id) map.set(l.id, l);
      for (const l of localLogs) if (l && l.id) map.set(l.id, l);

      let merged = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      if (merged.length > MAX_CLOUD_LOGS) {
        merged = merged.slice(0, MAX_CLOUD_LOGS);
      }

      const jsonStr = JSON.stringify(merged);
      const CHUNK_SIZE = 100000;
      const chunks: string[] = [];
      for (let i = 0; i < jsonStr.length; i += CHUNK_SIZE) {
        chunks.push(jsonStr.substring(i, i + CHUNK_SIZE));
      }

      await supabase.from('standard_tasks').upsert({ id: SLOT_ID, tasks: chunks });
    } catch (err) {
      console.warn('[SystemLogger] Cloud sync error:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Send log entry directly to local Express server if reachable
   */
  private async sendToLocalServer(item: SystemLogItem): Promise<void> {
    try {
      await ServerConfigService.apiPost('/api/logs', item);
    } catch {
      // Local server might be stopped; gracefully ignore
    }
  }

  /**
   * Format logs as human-readable text file content
   */
  public formatLogsAsText(logs: SystemLogItem[]): string {
    const nowStr = this.formatDate(new Date());
    const header = [
      '================================================================================',
      '                     İŞ TAKİP SİSTEMİ - HATA VE SİSTEM GÜNLÜĞÜ                   ',
      `  Rapor Oluşturulma: ${nowStr}`,
      `  Toplam Log Kaydı : ${logs.length}`,
      '================================================================================\n',
    ].join('\n');

    const body = logs
      .map((item) => {
        const userInfo = item.userName
          ? `[Kullanıcı: ${item.userName}${item.companyCode ? ' / ' + item.companyCode : ''}] `
          : '';
        let line = `[${item.dateStr}] [${item.level}] [${item.category}] ${userInfo}${item.message}`;
        if (item.details) {
          line += `\n   -> Detay: ${item.details.replace(/\n/g, '\n      ')}`;
        }
        if (item.deviceInfo) {
          line += `\n   -> Cihaz: ${item.deviceInfo}`;
        }
        return line;
      })
      .join('\n--------------------------------------------------------------------------------\n');

    return `${header}${body}\n================================================================================\n`;
  }

  /**
   * Trigger browser file download for the logs
   */
  public async downloadLogFile(filenamePrefix: string = 'is_takip_hatalari'): Promise<void> {
    const logs = await this.fetchAllLogs();
    const content = this.formatLogsAsText(logs);
    const dateStamp = new Date().toISOString().split('T')[0];
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${dateStamp}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all logs (local and cloud)
   */
  public async clearLogs(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SYSTEM_LOGS_LOCAL_KEY);
    }
    try {
      await supabase.from('standard_tasks').upsert({ id: SLOT_ID, tasks: ['[]'] });
    } catch {}
  }
}

export const SystemLogger = new SystemLoggerService();
