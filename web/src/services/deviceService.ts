import { RegisteredDevice } from '../types/storage';
import { isUserAdmin } from '../types/auth';
import { supabase } from './supabaseClient';
import { detectEnvironment, OneSignalService } from './oneSignalService';
import { StorageService } from './storageService';

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
    const storageKey = StorageService.getStorageKey(REGISTERED_DEVICES_KEY);
    let localData: RegisteredDevice[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
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
        .eq('id', StorageService.getSlotId(8))
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: RegisteredDevice[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(parsed));
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
    const storageKey = StorageService.getStorageKey(REGISTERED_DEVICES_KEY);
    try {
      localStorage.setItem(storageKey, JSON.stringify(devices));
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
      await supabase.from('standard_tasks').upsert({ id: StorageService.getSlotId(8), tasks: chunks });
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

  // ==========================================
  // USER DEVICE BINDING (ANTI-FRAUD LOCK)
  // ==========================================

  /**
   * Fetches all user device bindings from Supabase slot 9 (with local cache mirror)
   */
  async getUserDeviceBindings(): Promise<import('../types/storage').UserDeviceBinding[]> {
    const STORAGE_BINDINGS_KEY = StorageService.getStorageKey('@saha_takip_user_device_bindings');
    let localData: import('../types/storage').UserDeviceBinding[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_BINDINGS_KEY);
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
        .eq('id', StorageService.getSlotId(9))
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: import('../types/storage').UserDeviceBinding[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          try {
            localStorage.setItem(STORAGE_BINDINGS_KEY, JSON.stringify(parsed));
          } catch {
            // ignore
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Cloud fetch user device bindings error:', e);
    }

    return localData;
  },

  /**
   * Saves user device bindings to Supabase slot 9
   */
  async saveUserDeviceBindingsToCloud(
    bindings: import('../types/storage').UserDeviceBinding[]
  ): Promise<void> {
    const STORAGE_BINDINGS_KEY = StorageService.getStorageKey('@saha_takip_user_device_bindings');
    try {
      localStorage.setItem(STORAGE_BINDINGS_KEY, JSON.stringify(bindings));
    } catch {
      // ignore
    }

    try {
      const rawJson = JSON.stringify(bindings);
      const chunks: string[] = [];
      const chunkSize = 8000;
      for (let i = 0; i < rawJson.length; i += chunkSize) {
        chunks.push(rawJson.slice(i, i + chunkSize));
      }
      await supabase.from('standard_tasks').upsert({ id: StorageService.getSlotId(9), tasks: chunks });
    } catch (err) {
      console.warn('Cloud save user device bindings error:', err);
    }
  },

  /**
   * Retrieves binding for a specific user
   */
  async getBindingForUser(
    userId: string,
    username?: string
  ): Promise<import('../types/storage').UserDeviceBinding | null> {
    const bindings = await this.getUserDeviceBindings();
    const cleanUser = (username || '').trim().toLowerCase();
    return (
      bindings.find(
        (b) => b.userId === userId || (cleanUser && b.username.toLowerCase() === cleanUser)
      ) || null
    );
  },

  /**
   * Binds a user strictly to a device ID
   */
  async bindUserToDevice(params: {
    userId: string;
    username: string;
    userName: string;
    deviceId: string;
    deviceName: string;
    platform: 'ios' | 'android' | 'desktop';
  }): Promise<import('../types/storage').UserDeviceBinding> {
    const bindings = await this.getUserDeviceBindings();
    const newBinding: import('../types/storage').UserDeviceBinding = {
      userId: params.userId,
      username: params.username,
      userName: params.userName,
      boundDeviceId: params.deviceId,
      boundDeviceName: params.deviceName,
      boundPlatform: params.platform,
      boundAt: new Date().toISOString(),
      isLocked: true,
    };

    const idx = bindings.findIndex((b) => b.userId === params.userId);
    let updated: import('../types/storage').UserDeviceBinding[];
    if (idx >= 0) {
      updated = [...bindings];
      updated[idx] = newBinding;
    } else {
      updated = [newBinding, ...bindings];
    }

    await this.saveUserDeviceBindingsToCloud(updated);
    return newBinding;
  },

  /**
   * Unbinds / resets device lock for a user (Called by Admin)
   */
  async unbindUserDevice(userId: string): Promise<void> {
    const bindings = await this.getUserDeviceBindings();
    const filtered = bindings.filter((b) => b.userId !== userId);
    await this.saveUserDeviceBindingsToCloud(filtered);
  },

  /**
   * Verifies if current device is authorized for this user.
   * - Admins are exempt (can login from any device).
   * - Staff are locked to their boundDeviceId.
   * - If staff has no binding yet, auto-binds current device on first login.
   */
  async verifyDeviceAccess(params: {
    userId: string;
    role: string;
    currentDeviceId: string;
    userName?: string;
    username?: string;
  }): Promise<{
    allowed: boolean;
    error?: string;
    binding?: import('../types/storage').UserDeviceBinding;
  }> {
    // 1. Admins have access from any device (laptop, office PC, phone)
    if (params.role === 'admin' || isUserAdmin(params)) {
      return { allowed: true };
    }

    const currentId = params.currentDeviceId || this.getCurrentDeviceId();
    const currentName = this.getCurrentDeviceName(params.userName);
    const env = detectEnvironment();

    // 2. Fetch current binding for this user
    const existingBinding = await this.getBindingForUser(params.userId, params.username);

    // 3. First login or reset lock: automatically bind current device
    if (!existingBinding || !existingBinding.boundDeviceId) {
      const createdBinding = await this.bindUserToDevice({
        userId: params.userId,
        username: params.username || '',
        userName: params.userName || '',
        deviceId: currentId,
        deviceName: currentName,
        platform: env.platform,
      });
      return { allowed: true, binding: createdBinding };
    }

    // 4. Check if current device matches bound device
    if (existingBinding.isLocked && existingBinding.boundDeviceId !== currentId) {
      const boundDesc = existingBinding.boundDeviceName
        ? `"${existingBinding.boundDeviceName}" (${existingBinding.boundDeviceId})`
        : `"${existingBinding.boundDeviceId}"`;

      // Check if current device belongs to another registered staff member
      let ownerBinding: import('../types/storage').UserDeviceBinding | undefined;
      try {
        const allBindings = await this.getUserDeviceBindings();
        ownerBinding = allBindings.find(
          (b) => b.boundDeviceId === currentId && b.userId !== params.userId
        );
      } catch {
        // ignore
      }

      const attemptingUser = params.userName || params.username || 'Bilinmeyen Personel';
      let securityLogMessage: string;

      if (ownerBinding) {
        // Exact user requirement format:
        // "XXXXX kullanıcı isimli personel, XXXX ID numaralı XXXX kullanıcısına ait Telefonla giriş yapmaya çalıştı"
        const ownerName = ownerBinding.userName || ownerBinding.username || 'Personel';
        const ownerId = ownerBinding.userId || ownerBinding.username;
        securityLogMessage = `${attemptingUser} kullanıcı isimli personel, ${ownerId} ID numaralı ${ownerName} kullanıcısına ait Telefonla giriş yapmaya çalıştı.`;
      } else {
        securityLogMessage = `${attemptingUser} kullanıcı isimli personel, ${currentId} ID numaralı yetkisiz bir cihazla giriş yapmaya çalıştı.`;
      }

      // Automatically log the security event to cloud slot 12
      StorageService.logSecurityEvent({
        attemptedUsername: params.username || attemptingUser,
        attemptedName: params.userName,
        attemptedUserId: params.userId,
        boundUserId: ownerBinding?.userId,
        boundUserName: ownerBinding?.userName,
        deviceId: currentId,
        deviceName: currentName,
        platform: env.platform,
        message: securityLogMessage,
        status: 'danger',
      }).catch((logErr) => console.warn('Güvenlik logu atılamadı:', logErr));

      // Realtime hardware push notification to Admin
      OneSignalService.sendPushNotification({
        title: '🚨 Güvenlik & Cihaz Uyuşmazlığı İhlali',
        message: securityLogMessage,
        targetMode: 'admin',
        url: 'https://saha-takip-beige.vercel.app/?tab=logs',
      }).catch((pushErr) => console.warn('Güvenlik ihlali bildirimi gönderilemedi:', pushErr));

      return {
        allowed: false,
        error: `🚫 Giriş Engellendi: Bu kullanıcı hesabı başka bir cihaza [${boundDesc}] kilitlidir. Başka bir personelin telefonundan veya farklı bir cihazdan giriş yapamazsınız. Cihaz değişikliği gerekiyorsa lütfen yöneticinizle iletişime geçin.`,
        binding: existingBinding,
      };
    }

    return { allowed: true, binding: existingBinding };
  },
};
