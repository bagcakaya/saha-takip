import { ONESIGNAL_CONFIG } from '../constants/oneSignalConfig';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignalDeferred?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignal?: any;
  }
}

export interface SubscriptionDetails {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  subscriptionId: string | null;
  userId: string | null;
}

export const OneSignalService = {
  initialized: false,

  /**
   * Initializes OneSignal Web SDK with unified worker
   */
  init(): void {
    if (typeof window === 'undefined' || this.initialized) return;

    // Only initialize if App ID is provided
    if (!ONESIGNAL_CONFIG.APP_ID || ONESIGNAL_CONFIG.APP_ID === 'YOUR_ONESIGNAL_APP_ID') {
      console.log('OneSignal App ID henüz girilmedi, beklemede.');
      return;
    }

    this.initialized = true;

    // Load OneSignal SDK Script
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    document.head.appendChild(script);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.init({
        appId: ONESIGNAL_CONFIG.APP_ID,
        allowLocalhostAsSecureOrigin: ONESIGNAL_CONFIG.ALLOW_LOCAL_HOST,
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
      });

      // Keep push subscription persistently synced and active across token refreshes
      if (OneSignal.User && OneSignal.User.pushSubscription) {
        OneSignal.User.pushSubscription.addEventListener('change', async (event: any) => {
          console.log('OneSignal push aboneliği güncellendi:', event);
          try {
            const storedUser = localStorage.getItem('@gorev_tamamlama_auth_user');
            if (storedUser) {
              const u = JSON.parse(storedUser);
              if (u && u.id) {
                await OneSignal.login(u.id);
                if (OneSignal.User && OneSignal.User.addTags) {
                  await OneSignal.User.addTags({ userId: u.id, role: u.role, name: u.name });
                }
              }
            }
          } catch {
            // ignore
          }
        });
      }
    });
  },

  /**
   * Associates current device with the logged-in user ID and ensures opt-in
   */
  loginUser(userId: string, name: string, role: string): void {
    if (typeof window === 'undefined') return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.login(userId);
        if (OneSignal.User && OneSignal.User.addTags) {
          await OneSignal.User.addTags({ name, role, userId });
        }
        // If permission is already granted in browser, ensure push subscription is opted-in & active
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          if (OneSignal.User?.pushSubscription?.optIn) {
            await OneSignal.User.pushSubscription.optIn();
          }
        }
      } catch (e) {
        console.warn('OneSignal login hatası:', e);
      }
    });
  },

  /**
   * Disassociates user from device on logout
   */
  logoutUser(): void {
    if (typeof window === 'undefined') return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.logout();
      } catch (e) {
        console.warn('OneSignal logout hatası:', e);
      }
    });
  },

  /**
   * Retrieves current push subscription details for diagnostics
   */
  async getSubscriptionDetails(): Promise<SubscriptionDetails> {
    if (typeof window === 'undefined') {
      return {
        isSupported: false,
        permission: 'unsupported',
        isSubscribed: false,
        subscriptionId: null,
        userId: null,
      };
    }

    return new Promise((resolve) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          const isSupported =
            typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
          const permission =
            typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
          const subId = OneSignal.User?.pushSubscription?.id || null;
          const optedIn = OneSignal.User?.pushSubscription?.optedIn ?? false;
          const isSubscribed = permission === 'granted' && optedIn;

          resolve({
            isSupported,
            permission,
            isSubscribed,
            subscriptionId: subId,
            userId: OneSignal.User?.externalId || null,
          });
        } catch {
          resolve({
            isSupported: false,
            permission: 'denied',
            isSubscribed: false,
            subscriptionId: null,
            userId: null,
          });
        }
      });
    });
  },

  /**
   * Prompts user for notification permission, opts in, and firmly re-links user tags
   */
  async requestPermission(user?: { id: string; name: string; role: string }): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    return new Promise((resolve) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
            await OneSignal.Notifications.requestPermission();
          }

          // Force opt-in to wake up push subscription
          if (OneSignal.User?.pushSubscription?.optIn) {
            await OneSignal.User.pushSubscription.optIn();
          }

          // If user info is available, firmly re-login and re-tag
          if (user) {
            await OneSignal.login(user.id);
            if (OneSignal.User && OneSignal.User.addTags) {
              await OneSignal.User.addTags({
                name: user.name,
                role: user.role,
                userId: user.id,
              });
            }
          }

          const isGranted =
            OneSignal.Notifications?.permission === true ||
            (typeof Notification !== 'undefined' && Notification.permission === 'granted');

          resolve(isGranted);
        } catch (e) {
          console.warn('OneSignal requestPermission hatası:', e);
          resolve(false);
        }
      });
    });
  },

  /**
   * Sends a hardware push notification via OneSignal REST API directly to locked phones
   */
  async sendPushNotification(params: {
    title: string;
    message: string;
    targetMode?: 'all' | 'custom' | 'self' | 'admin';
    targetUserIds?: string[];
    url?: string;
    sendAfter?: string;
  }): Promise<void> {
    const { title, message, targetMode = 'all', targetUserIds = [], url, sendAfter } = params;

    // If API Key or App ID is not configured, skip
    if (
      !ONESIGNAL_CONFIG.APP_ID ||
      ONESIGNAL_CONFIG.APP_ID === 'YOUR_ONESIGNAL_APP_ID' ||
      !ONESIGNAL_CONFIG.REST_API_KEY ||
      ONESIGNAL_CONFIG.REST_API_KEY === 'YOUR_ONESIGNAL_REST_API_KEY'
    ) {
      return;
    }

    if (targetMode === 'self') return;

    const cleanIds = Array.isArray(targetUserIds)
      ? targetUserIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (targetMode === 'custom' && cleanIds.length === 0) return;

    const basePayload: Record<string, any> = {
      app_id: ONESIGNAL_CONFIG.APP_ID,
      headings: { en: title, tr: title },
      contents: { en: message, tr: message },
      url: url || 'https://saha-takip-beige.vercel.app',
      web_url: url || 'https://saha-takip-beige.vercel.app',
      chrome_web_icon: 'https://saha-takip-beige.vercel.app/icon.png',
      chrome_web_badge: 'https://saha-takip-beige.vercel.app/icon.png',
      icon: 'https://saha-takip-beige.vercel.app/icon.png',
      priority: 10,
      android_visibility: 1,
      android_sound: 'default',
      ios_sound: 'default',
    };

    if (sendAfter) {
      basePayload.send_after = sendAfter;
    }

    try {
      if (targetMode === 'all') {
        const payload = { ...basePayload, included_segments: ['Total Subscriptions'] };
        await this._postNotification(payload);
      } else if (targetMode === 'admin') {
        // Tag-based routing for admin role
        const payload = {
          ...basePayload,
          filters: [{ field: 'tag', key: 'role', relation: '=', value: 'admin' }],
        };
        await this._postNotification(payload);
      } else {
        // Dual Routing for Target Users:
        // 1. Standard OneSignal v16 Alias Routing (external_id)
        const aliasPayload = {
          ...basePayload,
          include_aliases: { external_id: cleanIds },
          target_channel: 'push',
        };
        await this._postNotification(aliasPayload);

        // 2. Tag-based Fallback Routing (guarantees delivery even if user alias is reconnecting)
        if (cleanIds.length === 1) {
          const tagPayload = {
            ...basePayload,
            filters: [{ field: 'tag', key: 'userId', relation: '=', value: cleanIds[0] }],
          };
          await this._postNotification(tagPayload);
        } else if (cleanIds.length > 1) {
          const filterArr: any[] = [];
          cleanIds.forEach((id, idx) => {
            if (idx > 0) filterArr.push({ operator: 'OR' });
            filterArr.push({ field: 'tag', key: 'userId', relation: '=', value: id });
          });
          const tagPayload = { ...basePayload, filters: filterArr };
          await this._postNotification(tagPayload);
        }
      }
    } catch (err) {
      console.warn('OneSignal push gönderim hatası:', err);
    }
  },

  /**
   * Internal helper to post to OneSignal REST API
   */
  async _postNotification(payload: Record<string, any>): Promise<any> {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${ONESIGNAL_CONFIG.REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    return result;
  },
};
