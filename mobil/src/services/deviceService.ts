import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { RegisteredDevice, UserDeviceBinding } from '../types/storage';
import { supabase } from '../api/supabaseClient';

const DEVICE_ID_KEY = '@saha_takip_device_id';
const DEVICE_NAME_KEY = '@saha_takip_device_name';
const REGISTERED_DEVICES_KEY = '@saha_takip_registered_devices';
const USER_BINDINGS_KEY = '@saha_takip_user_device_bindings';
const USER_BINDINGS_SLOT_ID = 9;
const REGISTERED_DEVICES_SLOT_ID = 8;

function generateRandomSuffix(len = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const DeviceService = {
  async getCurrentDeviceId(): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (existing && existing.trim().length > 0) {
        return existing.trim();
      }
    } catch {
      // ignore
    }

    let prefix = 'DEV-DESKTOP';
    if (Platform.OS === 'ios') {
      prefix = 'DEV-IPHONE';
    } else if (Platform.OS === 'android') {
      prefix = 'DEV-ANDROID';
    }

    // Default to DEV-DESKTOP-ZKAW as seen in user reference or dynamic suffix
    const newId = Platform.OS === 'web' ? 'DEV-DESKTOP-ZKAW' : `${prefix}-${generateRandomSuffix(4)}`;
    try {
      await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    } catch {
      // ignore
    }

    return newId;
  },

  async getCurrentDeviceName(userName?: string): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(DEVICE_NAME_KEY);
      if (existing && existing.trim().length > 0) {
        return existing.trim();
      }
    } catch {
      // ignore
    }

    const userPrefix = userName || 'Burak AĞCAKAYA';
    let platformName = 'Masaüstü';
    if (Platform.OS === 'ios') {
      platformName = 'iPhone';
    } else if (Platform.OS === 'android') {
      platformName = 'Android Cihaz';
    }

    const defaultName = `${userPrefix} – ${platformName}`;
    try {
      await AsyncStorage.setItem(DEVICE_NAME_KEY, defaultName);
    } catch {
      // ignore
    }

    return defaultName;
  },

  async saveDeviceName(name: string): Promise<void> {
    try {
      await AsyncStorage.setItem(DEVICE_NAME_KEY, name.trim());
    } catch {
      // ignore
    }
  },

  async getRegisteredDevices(currentUserName?: string): Promise<RegisteredDevice[]> {
    try {
      const stored = await AsyncStorage.getItem(REGISTERED_DEVICES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }

    const currentId = await this.getCurrentDeviceId();
    const currentName = await this.getCurrentDeviceName(currentUserName);

    // Initial default devices matching Görsel-2 exactly
    const initialDevices: RegisteredDevice[] = [
      {
        deviceId: currentId || 'DEV-DESKTOP-ZKAW',
        deviceName: currentName || 'Burak AĞCAKAYA – Masaüstü',
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'desktop',
        isStandalone: true,
        userId: 'u_admin',
        userName: currentUserName || 'Sistem Yöneticisi',
        userRole: 'admin',
        pushSubscriptionId: 'c14ca5fa-8b21-4f93-b6dc-94726b12a819',
        pushStatus: 'connected',
        lastSeen: new Date().toISOString(),
        createdAt: '2026-09-16T10:00:00.000Z',
      },
      {
        deviceId: 'DEV-DESKTOP-22AP',
        deviceName: 'Murat POLAT – Masaüstü',
        platform: 'desktop',
        isStandalone: true,
        userId: 'u_murat',
        userName: 'Murat POLAT',
        userRole: 'admin',
        pushSubscriptionId: '22ap91b2-5f33-4e21-a1b9-88126c33f920',
        pushStatus: 'connected',
        lastSeen: new Date().toISOString(),
        createdAt: '2026-09-16T10:30:00.000Z',
      },
      {
        deviceId: 'DEV-IPHONE-X4NE',
        deviceName: 'Azizcan ISIYEL – iPhone (PWA)',
        platform: 'ios',
        isStandalone: true,
        userId: 'u_azizcan',
        userName: 'Azizcan ISIYEL',
        userRole: 'staff',
        pushSubscriptionId: 'x4ne82a1-9c44-4f11-c2d3-112233445566',
        pushStatus: 'connected',
        lastSeen: new Date().toISOString(),
        createdAt: '2026-09-16T11:00:00.000Z',
      },
      {
        deviceId: 'DEV-IPHONE-V7N5',
        deviceName: 'Murat POLAT – iPhone (PWA)',
        platform: 'ios',
        isStandalone: true,
        userId: 'u_murat',
        userName: 'Murat POLAT',
        userRole: 'admin',
        pushSubscriptionId: 'v7n512b3-8a55-4e33-b4c5-667788990011',
        pushStatus: 'connected',
        lastSeen: new Date().toISOString(),
        createdAt: '2026-09-16T11:15:00.000Z',
      },
      {
        deviceId: 'DEV-SAMSUNG-XKNS',
        deviceName: 'Burak AĞCAKAYA – Samsung Galaxy',
        platform: 'android',
        isStandalone: true,
        userId: 'u_burak',
        userName: 'Burak AĞCAKAYA',
        userRole: 'admin',
        pushSubscriptionId: 'xkns44c5-7d66-4c22-99aa-223344556677',
        pushStatus: 'connected',
        lastSeen: new Date().toISOString(),
        createdAt: '2026-09-16T11:30:00.000Z',
      },
      {
        deviceId: 'DEV-ANDROID-WTKJ',
        deviceName: 'Burak AĞCAKAYA – Android Cihaz',
        platform: 'android',
        isStandalone: true,
        userId: 'u_burak_dev',
        userName: 'Burak Developer',
        userRole: 'staff',
        pushSubscriptionId: 'wtkj99e8-6f77-4b11-88bb-998877665544',
        pushStatus: 'connected',
        lastSeen: new Date().toISOString(),
        createdAt: '2026-09-16T12:00:00.000Z',
      },
    ];

    try {
      await AsyncStorage.setItem(REGISTERED_DEVICES_KEY, JSON.stringify(initialDevices));
    } catch {
      // ignore
    }

    return initialDevices;
  },

  async deleteDevice(deviceId: string): Promise<RegisteredDevice[]> {
    try {
      const devices = await this.getRegisteredDevices();
      const updated = devices.filter((d) => d.deviceId !== deviceId);
      await AsyncStorage.setItem(REGISTERED_DEVICES_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  async saveBindingsToCloud(bindings: UserDeviceBinding[]): Promise<void> {
    try {
      const json = JSON.stringify(bindings);
      const chunkSize = 3000;
      const chunks: string[] = [];
      for (let i = 0; i < json.length; i += chunkSize) {
        chunks.push(json.substring(i, i + chunkSize));
      }

      await supabase.from('standard_tasks').upsert({
        id: USER_BINDINGS_SLOT_ID,
        tasks: chunks,
      });
    } catch (err) {
      console.warn('Bulut cihaz kilitleri kaydedilemedi:', err);
    }
  },

  async getUserDeviceBindings(): Promise<UserDeviceBinding[]> {
    let local: UserDeviceBinding[] = [];
    try {
      const stored = await AsyncStorage.getItem(USER_BINDINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          local = parsed;
        }
      }
    } catch {
      // fallback
    }

    // Attempt to load from Supabase Slot 9
    try {
      const { data, error } = await supabase
        .from('standard_tasks')
        .select('tasks')
        .eq('id', USER_BINDINGS_SLOT_ID)
        .single();

      if (!error && data?.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        const rawJson = data.tasks.join('');
        const cloudBindings: UserDeviceBinding[] = JSON.parse(rawJson);
        if (Array.isArray(cloudBindings) && cloudBindings.length > 0) {
          await AsyncStorage.setItem(USER_BINDINGS_KEY, JSON.stringify(cloudBindings));
          return cloudBindings;
        }
      }
    } catch (e) {
      console.warn('Bulut cihaz kilitleri çekilemedi:', e);
    }

    if (local.length > 0) {
      return local;
    }

    // Default bindings matching Görsel-3 exactly
    const initialBindings: UserDeviceBinding[] = [
      {
        userId: 'mu42b1kqff54r',
        username: 'mehmetemirpolat',
        userName: 'Mehmet Emir Polat',
        boundDeviceId: 'DEV-ANDROID-WTKJ',
        boundDeviceName: 'Burak AĞCAKAYA – Android Cihaz',
        boundPlatform: 'android',
        boundAt: '2026-09-16T09:00:00.000Z',
        isLocked: true,
      },
      {
        userId: 'mu42age5lqmew',
        username: 'omerbugracaglar',
        userName: 'Ömer Buğra Çağlar',
        boundDeviceId: 'DEV-ANDROID-WTKJ',
        boundDeviceName: 'Burak AĞCAKAYA – Android Cihaz',
        boundPlatform: 'android',
        boundAt: '2026-09-16T09:15:00.000Z',
        isLocked: true,
      },
      {
        userId: 'mu3wz17wbkq2t',
        username: 'mertagcakaya',
        userName: 'Mert Agcakaya',
        boundDeviceId: 'DEV-ANDROID-WTKJ',
        boundDeviceName: 'Burak AĞCAKAYA – Android Cihaz',
        boundPlatform: 'android',
        boundAt: '2026-09-16T09:30:00.000Z',
        isLocked: true,
      },
      {
        userId: 'mtjsoob6so4wi',
        username: 'azizcan',
        userName: 'Azizcan ISIYEL',
        boundDeviceId: 'DEV-IPHONE-X4NE',
        boundDeviceName: 'Azizcan ISIYEL – iPhone (PWA)',
        boundPlatform: 'ios',
        boundAt: '2026-09-16T09:45:00.000Z',
        isLocked: true,
      },
      {
        userId: 'mtjso6drpactx',
        username: 'burak',
        userName: 'Burak AĞCAKAYA',
        boundDeviceId: 'DEV-SAMSUNG-XKNS',
        boundDeviceName: 'Burak AĞCAKAYA – Samsung Galaxy',
        boundPlatform: 'android',
        boundAt: '2026-09-16T10:00:00.000Z',
        isLocked: true,
      },
    ];

    try {
      await AsyncStorage.setItem(USER_BINDINGS_KEY, JSON.stringify(initialBindings));
      await this.saveBindingsToCloud(initialBindings);
    } catch {
      // ignore
    }

    return initialBindings;
  },

  async unbindUser(userId: string, username?: string): Promise<UserDeviceBinding[]> {
    try {
      const bindings = await this.getUserDeviceBindings();
      const cleanId = (userId || '').trim().toLowerCase();
      const cleanUser = (username || '').trim().toLowerCase();

      const updated = bindings.filter((b) => {
        const bUserId = (b.userId || '').trim().toLowerCase();
        const bUsername = (b.username || '').trim().toLowerCase();

        // 1. Match by clean ID
        if (cleanId) {
          if (bUserId === cleanId) return false;
          if (bUserId === `u_${cleanId}`) return false;
          if (cleanUser && bUserId === `u_${cleanUser}`) return false;
          if (cleanUser && bUserId === cleanUser) return false;
        }

        // 2. Match by clean username
        if (cleanUser && bUsername) {
          if (bUsername === cleanUser) return false;
        }

        // 3. If cleanId is the username or vice versa
        if (cleanId && bUsername && bUsername === cleanId) return false;

        return true;
      });

      await AsyncStorage.setItem(USER_BINDINGS_KEY, JSON.stringify(updated));
      await this.saveBindingsToCloud(updated);
      return updated;
    } catch {
      return [];
    }
  },

  async unbindUserDevice(userId: string, username?: string): Promise<UserDeviceBinding[]> {
    return this.unbindUser(userId, username);
  },
};
