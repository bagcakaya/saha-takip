import { RegisteredDevice } from '../types/storage';
import { supabase } from './supabaseClient';
import { detectEnvironment } from './oneSignalService';

const DEVICE_ID_KEY = '@saha_takip_device_id';
const DEVICE_NAME_KEY = '@saha_takip_device_name';
const REGISTERED_DEVICES_KEY = '@saha_takip_registered_devices';

function generateRandomSuffix(len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const DeviceService = {
  /**
   * Retrieves or creates a persistent unique Device ID for this browser/device
   */
  getCurrentDeviceId(): string {
    if (typeof window === 'undefined') return 'DEV-SERVER';

    try {
      const existing = localStorage.getItem(DEVICE_ID_KEY);
      if (existing && existing.trim().length > 0) {
        return existing.trim();
      }
    } catch {
      // ignore
    }

    const env = detectEnvironment();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    let prefix = 'DEV-DESKTOP';

    if (env.isIOS) {
      prefix = 'DEV-IPHONE';
    } else if (env.isAndroid) {
      if (ua.includes('samsung') || ua.includes('sm-')) {
        prefix = 'DEV-SAMSUNG';
      } else {
        prefix = 'DEV-ANDROID';
      }
    }

    const newId = `${prefix}-${generateRandomSuffix(4)}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, newId);
    } catch {
      // ignore
    }

    return newId;
  },

  /**
   * Retrieves or generates friendly name for current device
   */
  getCurrentDeviceName(userName?: string): string {
    if (typeof window === 'undefined') return 'Bilinmeyen Cihaz';

    try {
      const existing = localStorage.getItem(DEVICE_NAME_KEY);
      if (existing && existing.trim().length > 0) {
        return existing.trim();
      }
    } catch {
      // ignore
    }

    const env = detectEnvironment();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const userPrefix = userName ? userName : 'Saha';

    let platformName = 'Masaüstü';
    if (env.isIOS) {
      platformName = env.isStandalone ? 'iPhone (PWA)' : 'iPhone (Safari)';
    } else if (env.isAndroid) {
      if (ua.includes('samsung') || ua.includes('sm-')) {
        platformName = 'Samsung Galaxy';
      } else {
        platformName = 'Android Cihaz';
      }
    }

    const defaultName = `${userPrefix} - ${platformName}`;
    try {
      localStorage.setItem(DEVICE_NAME_KEY, defaultName);
    } catch {
      // ignore
    }

    return defaultName;
  },

  /**
   * Updates friendly name for a device
   */
  async setDeviceName(deviceId: string, newName: string): Promise<void> {
    const cleanName = newName.trim();
    if (!cleanName) return;

    const currentId = this.getCurrentDeviceId();
    if (deviceId === currentId) {
      try {
        localStorage.setItem(DEVICE_NAME_KEY, cleanName);
      } catch {
        // ignore
      }
    }

    // Update in registered devices cloud list
    try {
      const devices = await this.getRegisteredDevices();
      const updated = devices.map((d) =>
        d.deviceId === deviceId ? { ...d, deviceName: cleanName } : d
      );
      await this.saveRegisteredDevicesToCloud(updated);
    } catch (e) {
      console.warn('Cihaz adı güncellenemedi:', e);
    }
  },

  /**
   * Registers or updates current device details in Supabase cloud registry
   */
  async syncCurrentDevice(params: {
    user: { id: string; name: string; role: string };
    pushSubscriptionId?: string | null;
    pushStatus?: 'connected' | 'pending' | 'denied';
  }): Promise<RegisteredDevice> {
    const deviceId = this.getCurrentDeviceId();
    const deviceName = this.getCurrentDeviceName(params.user.name);
    const env = detectEnvironment();

    const pushSubId =
      params.pushSubscriptionId !== undefined
        ? params.pushSubscriptionId
        : typeof localStorage !== 'undefined'
        ? localStorage.getItem('@saha_takip_last_sub_id')
        : null;

    let finalPushStatus: 'connected' | 'pending' | 'denied' = 'pending';
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'denied') {
        finalPushStatus = 'denied';
      } else if (Notification.permission === 'granted' && pushSubId) {
        finalPushStatus = 'connected';
      }
    }
    if (params.pushStatus) {
      finalPushStatus = params.pushStatus;
    }

    const currentDevice: RegisteredDevice = {
      deviceId,
      deviceName,
      userId: params.user.id,
      userName: params.user.name,
      userRole: params.user.role,
      platform: env.platform,
      isStandalone: env.isStandalone,
      pushSubscriptionId: pushSubId || null,
      pushStatus: finalPushStatus,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    try {
      const existingDevices = await this.getRegisteredDevices();
      const index = existingDevices.findIndex((d) => d.deviceId === deviceId);

      let merged: RegisteredDevice[];
      if (index >= 0) {
        merged = [...existingDevices];
        merged[index] = {
          ...merged[index],
          ...currentDevice,
          createdAt: merged[index].createdAt || currentDevice.createdAt,
          deviceName: merged[index].deviceName || currentDevice.deviceName,
        };
      } else {
        merged = [currentDevice, ...existingDevices];
      }

      await this.saveRegisteredDevicesToCloud(merged);
    } catch (err) {
      console.warn('Cihaz bulut eşitleme hatası:', err);
    }

    return currentDevice;
  },

  /**
   * Fetches all registered devices from Supabase cloud (slot 8) with local fallback
   */
  async getRegisteredDevices(): Promise<RegisteredDevice[]> {
    let localData: RegisteredDevice[] = [];
    try {
      const raw = localStorage.getItem(REGISTERED_DEVICES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localData = parsed;
      }
    } catch {
      // ignore
    }

    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', 8)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: RegisteredDevice[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          try {
            localStorage.setItem(REGISTERED_DEVICES_KEY, JSON.stringify(parsed));
          } catch {
            // ignore
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Cloud fetch registered devices error:', e);
    }

    return localData;
  },

  /**
   * Internal helper to save registered devices to Supabase slot 8
   */
  async saveRegisteredDevicesToCloud(devices: RegisteredDevice[]): Promise<void> {
    try {
      localStorage.setItem(REGISTERED_DEVICES_KEY, JSON.stringify(devices));
    } catch {
      // ignore
    }

    try {
      const rawJson = JSON.stringify(devices);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: 8, tasks: chunks });
    } catch (err) {
      console.warn('Cloud save registered devices error:', err);
    }
  },

  /**
   * Removes a device from registered devices
   */
  async deleteDevice(deviceId: string): Promise<void> {
    try {
      const existing = await this.getRegisteredDevices();
      const filtered = existing.filter((d) => d.deviceId !== deviceId);
      await this.saveRegisteredDevicesToCloud(filtered);
    } catch (e) {
      console.warn('Cihaz silme hatası:', e);
    }
  },
};
