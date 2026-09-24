import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ServerConfig {
  mode: 'cloud' | 'local'; // 'cloud' (Supabase/Firebase) or 'local' (Windows Server 2022 SQL Server)
  localUrl: string; // e.g. 'http://192.168.1.100:3001' or 'http://88.255.x.x:3001'
  lastTestedAt?: number;
  lastTestSuccess?: boolean;
}

const SERVER_CONFIG_KEY = '@saha_takip_server_config';

export function normalizeServerUrl(url: string): string {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  // Strip any existing protocol and any leading slashes (e.g. //81.213.219.69:3001 or http:////...)
  cleaned = cleaned.replace(/^https?:\/*/i, '');
  cleaned = cleaned.replace(/^\/+/, '');
  // Fix accidental dot before port, e.g. 81.213.219.69.3001 -> 81.213.219.69:3001
  cleaned = cleaned.replace(/\.3001$/, ':3001');
  if (cleaned.endsWith(':')) {
    cleaned += '3001';
  } else if (/^\d+\.\d+\.\d+\.\d+$/i.test(cleaned)) {
    cleaned += ':3001';
  }
  return 'http://' + cleaned;
}

const MIGRATION_KEY = '@saha_takip_migrated_to_local_v1';

const DEFAULT_SERVER_CONFIG: ServerConfig = {
  mode: 'local',
  localUrl: 'http://81.213.219.69:3001',
  lastTestedAt: undefined,
  lastTestSuccess: undefined,
};

let inMemoryConfig: ServerConfig = { ...DEFAULT_SERVER_CONFIG };
let isLoaded = false;
const listeners = new Set<(cfg: ServerConfig) => void>();

export const MobileServerConfigService = {
  async init(): Promise<ServerConfig> {
    if (isLoaded) return inMemoryConfig;
    try {
      const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
      if (!migrated) {
        // Bir defalık otomatik geçiş: Tüm kullanıcıları doğrudan yerel sunucuya geçir
        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        const currentRaw = await AsyncStorage.getItem(SERVER_CONFIG_KEY);
        const currentParsed = currentRaw ? JSON.parse(currentRaw) : {};
        const migratedConfig: ServerConfig = {
          ...DEFAULT_SERVER_CONFIG,
          ...currentParsed,
          mode: 'local',
          localUrl: 'http://81.213.219.69:3001',
        };
        await AsyncStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(migratedConfig));
        inMemoryConfig = migratedConfig;
        isLoaded = true;
        return inMemoryConfig;
      }

      const raw = await AsyncStorage.getItem(SERVER_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        inMemoryConfig = { ...DEFAULT_SERVER_CONFIG, ...parsed, localUrl: normalizeServerUrl(parsed.localUrl || DEFAULT_SERVER_CONFIG.localUrl) };
      }
    } catch {
      // ignore
    }
    isLoaded = true;
    return inMemoryConfig;
  },

  getConfig(): ServerConfig {
    return inMemoryConfig;
  },

  async saveConfig(partial: Partial<ServerConfig>): Promise<ServerConfig> {
    const current = inMemoryConfig;
    const updated: ServerConfig = {
      ...current,
      ...partial,
      localUrl: partial.localUrl !== undefined ? normalizeServerUrl(partial.localUrl) : current.localUrl,
    };
    inMemoryConfig = updated;
    try {
      await AsyncStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(updated));
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
    return inMemoryConfig.mode === 'local';
  },

  getActiveApiUrl(): string | null {
    if (inMemoryConfig.mode === 'local' && inMemoryConfig.localUrl) {
      return inMemoryConfig.localUrl.replace(/\/+$/, '');
    }
    return null;
  },

  async testConnection(targetUrl?: string): Promise<{ success: boolean; message: string; database?: string }> {
    const rawUrl = normalizeServerUrl(targetUrl || inMemoryConfig.localUrl || '');
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

// Auto initialize on import
MobileServerConfigService.init();
