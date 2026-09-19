export interface ServerConfig {
  mode: 'cloud' | 'local'; // 'cloud' (Supabase/Firebase) or 'local' (Windows Server 2022 SQL Server)
  localUrl: string; // e.g. 'http://192.168.1.100:3001' or 'http://88.255.x.x:3001'
  lastTestedAt?: number;
  lastTestSuccess?: boolean;
}

const SERVER_CONFIG_KEY = '@saha_takip_server_config';

const DEFAULT_SERVER_CONFIG: ServerConfig = {
  mode: 'cloud',
  localUrl: 'http://192.168.1.100:3001',
  lastTestedAt: undefined,
  lastTestSuccess: undefined,
};

// Memory cache to avoid repeated localStorage reads
let inMemoryConfig: ServerConfig | null = null;
const listeners = new Set<(cfg: ServerConfig) => void>();

export const ServerConfigService = {
  getConfig(): ServerConfig {
    if (inMemoryConfig) return inMemoryConfig;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SERVER_CONFIG_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        inMemoryConfig = { ...DEFAULT_SERVER_CONFIG, ...parsed };
        return inMemoryConfig!;
      }
    } catch {
      // ignore
    }
    inMemoryConfig = { ...DEFAULT_SERVER_CONFIG };
    return inMemoryConfig;
  },

  saveConfig(partial: Partial<ServerConfig>): ServerConfig {
    const current = this.getConfig();
    const updated: ServerConfig = {
      ...current,
      ...partial,
      localUrl: (partial.localUrl !== undefined ? partial.localUrl : current.localUrl).trim().replace(/\/+$/, ''),
    };
    inMemoryConfig = updated;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }
    listeners.forEach((fn) => fn(updated));
    return updated;
  },

  subscribe(listener: (cfg: ServerConfig) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isLocalMode(): boolean {
    return this.getConfig().mode === 'local';
  },

  getActiveApiUrl(): string | null {
    const cfg = this.getConfig();
    if (cfg.mode === 'local' && cfg.localUrl) {
      return cfg.localUrl.replace(/\/+$/, '');
    }
    return null; // Cloud mode active
  },

  async testConnection(targetUrl?: string): Promise<{ success: boolean; message: string; database?: string }> {
    const rawUrl = (targetUrl || this.getConfig().localUrl || '').trim().replace(/\/+$/, '');
    if (!rawUrl) {
      return { success: false, message: 'Sunucu adresi boş olamaz.' };
    }

    const healthUrl = `${rawUrl}/api/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000); // 7s timeout

    try {
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        return {
          success: false,
          message: `Sunucu yanıt verdi ancak HTTP hatası oluştu (${res.status} ${res.statusText}).`,
        };
      }

      const data = await res.json();
      if (data && data.status === 'ok') {
        return {
          success: true,
          message: 'Bağlantı başarılı! Yerel sunucu ve veritabanı aktif.',
          database: data.database,
        };
      }

      return {
        success: false,
        message: 'Sunucuya ulaşıldı fakat sağlık kontrolü başarısız: ' + JSON.stringify(data),
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return {
          success: false,
          message: 'Zaman aşımı (7sn). Sunucuya ulaşılamadı. IP adresini ve 3001 portunu kontrol edin.',
        };
      }
      return {
        success: false,
        message: 'Sunucuya bağlanılamadı: ' + (err?.message || 'Ağ hatası veya port kapalı.'),
      };
    }
  },

  async apiGet<T>(endpoint: string): Promise<{ data: T | null; error?: string }> {
    const baseUrl = this.getActiveApiUrl();
    if (!baseUrl) return { data: null, error: 'Not in local mode' };
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { data };
    } catch (e: any) {
      return { data: null, error: e?.message };
    }
  },

  async apiPost<T>(endpoint: string, body: any): Promise<{ data: T | null; error?: string }> {
    const baseUrl = this.getActiveApiUrl();
    if (!baseUrl) return { data: null, error: 'Not in local mode' };
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { data };
    } catch (e: any) {
      return { data: null, error: e?.message };
    }
  },
};
