import { ONESIGNAL_CONFIG } from '../constants/oneSignalConfig';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignalDeferred?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignal?: any;
  }
}

export const OneSignalService = {
  initialized: false,

  /**
   * Initializes OneSignal Web SDK
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
    });
  },

  /**
   * Associates current device with the logged-in user ID
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
      } catch (e) {
        console.warn('OneSignal login error:', e);
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
        console.warn('OneSignal logout error:', e);
      }
    });
  },

  /**
   * Prompts user for notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    return new Promise((resolve) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
            await OneSignal.Notifications.requestPermission();
            resolve(OneSignal.Notifications.permission);
          } else {
            resolve(false);
          }
        } catch {
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
    targetMode?: 'all' | 'custom' | 'self';
    targetUserIds?: string[];
    url?: string;
  }): Promise<void> {
    const { title, message, targetMode = 'all', targetUserIds = [], url } = params;

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
    if (targetMode === 'custom' && targetUserIds.length === 0) return;

    try {
      const payload: Record<string, any> = {
        app_id: ONESIGNAL_CONFIG.APP_ID,
        headings: { en: title, tr: title },
        contents: { en: message, tr: message },
        url: url || 'https://saha-takip-beige.vercel.app',
      };

      if (targetMode === 'all') {
        payload.included_segments = ['Total Subscriptions'];
      } else {
        payload.include_aliases = { external_id: targetUserIds };
        payload.target_channel = 'push';
      }

      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${ONESIGNAL_CONFIG.REST_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('OneSignal push gönderim hatası:', err);
    }
  },
};
