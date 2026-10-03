import { RegisteredDevice } from '../types/storage';
import { isUserAdmin } from '../types/auth';
import { supabase } from './supabaseClient';
import { detectEnvironment, OneSignalService } from './oneSignalService';
import { StorageService } from './storageService';
import { UserService } from './userService';

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
  async setDeviceName(deviceId: string, newName: string, companyCode?: string): Promise<void> {
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
      const devices = await this.getRegisteredDevices(companyCode);
      const updated = devices.map((d) =>
        d.deviceId === deviceId ? { ...d, deviceName: cleanName } : d
      );
      await this.saveRegisteredDevicesToCloud(updated, companyCode);
    } catch (e) {
      console.warn('Cihaz adı güncellenemedi:', e);
    }
  },

  /**
   * Registers or updates current device details in Supabase cloud registry
   */
  async syncCurrentDevice(params: {
    user: { id: string; name: string; role: string; companyCode?: string; username?: string };
    pushSubscriptionId?: string | null;
    pushStatus?: 'connected' | 'pending' | 'denied';
    companyCode?: string;
  }): Promise<RegisteredDevice> {
    const deviceId = this.getCurrentDeviceId();
    const deviceName = this.getCurrentDeviceName(params.user.name);
    const env = detectEnvironment();

    let targetComp = (
      params.companyCode ||
      params.user.companyCode ||
      UserService.getUserCompanyCode(params.user.id, params.user.username) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_code') : null) ||
      'POLATLAR'
    ).trim().toUpperCase();

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

    // STRICT MULTI-TENANT ISOLATION:
    // Ensure user actually belongs to targetComp before registering device into that company's cloud slot
    const userCompany = (
      params.user.companyCode ||
      UserService.getUserCompanyCode(params.user.id, params.user.username) ||
      targetComp
    ).trim().toUpperCase();

    if (userCompany !== targetComp) {
      console.warn(`DeviceService: Blocked syncing device for user ${params.user.id} (${userCompany}) into company slot ${targetComp}`);
      return {
        deviceId,
        deviceName,
        userId: params.user.id,
        userName: params.user.name,
        userRole: params.user.role,
        companyCode: userCompany,
        platform: env.platform,
        isStandalone: env.isStandalone,
        pushSubscriptionId: pushSubId || null,
        pushStatus: finalPushStatus,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    }

    const currentDevice: RegisteredDevice = {
      deviceId,
      deviceName,
      userId: params.user.id,
      userName: params.user.name,
      userRole: params.user.role,
      companyCode: targetComp,
      platform: env.platform,
      isStandalone: env.isStandalone,
      pushSubscriptionId: pushSubId || null,
      pushStatus: finalPushStatus,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    try {
      const existingDevices = await this.getRegisteredDevices(targetComp);
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

      await this.saveRegisteredDevicesToCloud(merged, targetComp);
    } catch (err) {
      console.warn('Cihaz bulut eşitleme hatası:', err);
    }

    return currentDevice;
  },

  /**
   * Fetches all registered devices from Supabase cloud (slot 8 / 28) with local fallback
   */
  async getRegisteredDevices(companyCode?: string): Promise<RegisteredDevice[]> {
    const targetComp = (
      companyCode ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_code') : null) ||
      'POLATLAR'
    ).trim().toUpperCase();
    const storageKey = StorageService.getStorageKeyForCompany(REGISTERED_DEVICES_KEY, targetComp);
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

    let devices: RegisteredDevice[] = localData;

    try {
      const slotId = StorageService.getSlotIdForCompany(8, targetComp);
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', slotId)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const parsed: RegisteredDevice[] = JSON.parse(rawJson);
        if (Array.isArray(parsed)) {
          devices = parsed;
          try {
            localStorage.setItem(storageKey, JSON.stringify(parsed));
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      console.warn('Cloud fetch registered devices error:', e);
    }

    // STRICT MULTI-TENANT FILTER:
    // Guarantee that ONLY devices strictly belonging to targetComp are returned
    const polatlarSubs = [
      '89bcd97c-28f4-4b7e-a70f-fb3748004de8',
      '2dfc8e02-5d2f-44b1-a38d-43c0d0b46872',
      '49243a90-8287-4363-8e19-3408dded8e7d',
      'f6404c9d-7e09-45cb-8912-b641db201343',
    ];

    return devices.filter((d) => {
      // 1. Explicit companyCode match if provided on device
      if (d.companyCode && d.companyCode.trim().toUpperCase() !== targetComp) {
        return false;
      }
      // 2. User company code check
      if (d.userId) {
        const uComp = UserService.getUserCompanyCode(d.userId);
        if (uComp && uComp !== targetComp) {
          return false;
        }
      }
      // 3. Prevent POLATLAR subs from leaking into other companies
      if (targetComp !== 'POLATLAR' && d.pushSubscriptionId && polatlarSubs.includes(d.pushSubscriptionId)) {
        return false;
      }
      return true;
    });
  },

  /**
   * Internal helper to save registered devices to Supabase slot 8 / 28
   */
  async saveRegisteredDevicesToCloud(devices: RegisteredDevice[], companyCode?: string): Promise<void> {
    const targetComp = (
      companyCode ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_code') : null) ||
      'POLATLAR'
    ).trim().toUpperCase();
    const storageKey = StorageService.getStorageKeyForCompany(REGISTERED_DEVICES_KEY, targetComp);
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
      const slotId = StorageService.getSlotIdForCompany(8, targetComp);
      await supabase.from('standard_tasks').upsert({ id: slotId, tasks: chunks });
    } catch (err) {
      console.warn('Cloud save registered devices error:', err);
    }
  },

  /**
   * Removes a device from registered devices
   */
  async deleteDevice(deviceId: string, companyCode?: string): Promise<void> {
    try {
      const existing = await this.getRegisteredDevices(companyCode);
      const filtered = existing.filter((d) => d.deviceId !== deviceId);
      await this.saveRegisteredDevicesToCloud(filtered, companyCode);
    } catch (e) {
      console.warn('Cihaz silme hatası:', e);
    }
  },

  // ==========================================
  // USER DEVICE BINDING (ANTI-FRAUD LOCK)
  // ==========================================

  /**
   * Fetches all user device bindings from Supabase slot 9 / slot 29 (with local cache mirror)
   */
  async getUserDeviceBindings(companyCode?: string): Promise<import('../types/storage').UserDeviceBinding[]> {
    const targetComp = (
      companyCode ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_code') : null) ||
      'POLATLAR'
    ).trim().toUpperCase();
    const STORAGE_BINDINGS_KEY = StorageService.getStorageKeyForCompany('@saha_takip_user_device_bindings', targetComp);
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
      const slotId = StorageService.getSlotIdForCompany(9, targetComp);
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', slotId)
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
   * Saves user device bindings to Supabase slot 9 / slot 29
   */
  async saveUserDeviceBindingsToCloud(
    bindings: import('../types/storage').UserDeviceBinding[],
    companyCode?: string
  ): Promise<void> {
    const targetComp = (
      companyCode ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_code') : null) ||
      'POLATLAR'
    ).trim().toUpperCase();
    const STORAGE_BINDINGS_KEY = StorageService.getStorageKeyForCompany('@saha_takip_user_device_bindings', targetComp);
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
      const slotId = StorageService.getSlotIdForCompany(9, targetComp);
      await supabase.from('standard_tasks').upsert({ id: slotId, tasks: chunks });
    } catch (err) {
      console.warn('Cloud save user device bindings error:', err);
    }
  },

  /**
   * Retrieves binding for a specific user
   */
  async getBindingForUser(
    userId: string,
    username?: string,
    companyCode?: string
  ): Promise<import('../types/storage').UserDeviceBinding | null> {
    let comp = companyCode;
    if (!comp) {
      comp = UserService.getUserCompanyCode(userId, username) || undefined;
    }
    const bindings = await this.getUserDeviceBindings(comp);
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
    companyCode?: string;
  }): Promise<import('../types/storage').UserDeviceBinding> {
    let comp = params.companyCode;
    if (!comp) {
      comp = UserService.getUserCompanyCode(params.userId, params.username) || undefined;
    }
    const bindings = await this.getUserDeviceBindings(comp);
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

    await this.saveUserDeviceBindingsToCloud(updated, comp);
    return newBinding;
  },

  /**
   * Unbinds / resets device lock for a user (Called by Admin)
   */
  async unbindUserDevice(userId: string, companyCode?: string): Promise<void> {
    let comp = companyCode;
    if (!comp) {
      comp = UserService.getUserCompanyCode(userId) || undefined;
    }
    const bindings = await this.getUserDeviceBindings(comp);
    const filtered = bindings.filter((b) => b.userId !== userId);
    await this.saveUserDeviceBindingsToCloud(filtered, comp);
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
    companyCode?: string;
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

    // Strictly resolve target company:
    let targetComp = (params.companyCode || '').trim().toUpperCase();
    if (!targetComp || targetComp === 'POLATLAR') {
      const userComp = UserService.getUserCompanyCode(params.userId, params.username);
      if (userComp) {
        targetComp = userComp;
      }
    }
    if (!targetComp) {
      targetComp = (
        (typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_company_code') : null) ||
        'POLATLAR'
      ).trim().toUpperCase();
    }

    // 2. Fetch current binding for this user strictly within this company
    const existingBinding = await this.getBindingForUser(params.userId, params.username, targetComp);

    // 3. First login or reset lock: automatically bind current device
    if (!existingBinding || !existingBinding.boundDeviceId) {
      const createdBinding = await this.bindUserToDevice({
        userId: params.userId,
        username: params.username || '',
        userName: params.userName || '',
        deviceId: currentId,
        deviceName: currentName,
        platform: env.platform,
        companyCode: targetComp,
      });
      return { allowed: true, binding: createdBinding };
    }

    // 4. Check if current device matches bound device
    if (existingBinding.isLocked && existingBinding.boundDeviceId !== currentId) {
      const boundDesc = existingBinding.boundDeviceName
        ? `"${existingBinding.boundDeviceName}" (${existingBinding.boundDeviceId})`
        : `"${existingBinding.boundDeviceId}"`;

      // Check if current device belongs to another registered staff member in this company
      let ownerBinding: import('../types/storage').UserDeviceBinding | undefined;
      try {
        const allBindings = await this.getUserDeviceBindings(targetComp);
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

      // Automatically log the security event to cloud slot 12 / slot 32
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
        companyCode: targetComp,
      }).catch((logErr) => console.warn('Güvenlik logu atılamadı:', logErr));

      // Realtime hardware push notification to Admin
      OneSignalService.sendPushNotification({
        title: '🚨 Güvenlik & Cihaz Uyuşmazlığı İhlali',
        message: securityLogMessage,
        targetMode: 'admin',
        companyCode: targetComp,
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
