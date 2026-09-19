import { LogLevel, OneSignal } from 'react-native-onesignal';
import { Platform } from 'react-native';
import { router } from 'expo-router';

export const ONESIGNAL_APP_ID = '03e50631-8d38-4796-a90f-ae524dab69fd';

export const MobileOneSignalService = {
  initialized: false,

  /**
   * Initializes OneSignal SDK, requests permissions and attaches click listeners
   */
  init(onNavigate?: (tab: string, filter?: string) => void) {
    if (this.initialized || Platform.OS === 'web') return;
    this.initialized = true;

    try {
      OneSignal.Debug.setLogLevel(LogLevel.Warn);
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // Prompt for push notification permission (Mandatory on Android 13+ and iOS)
      OneSignal.Notifications.requestPermission(true);

      // Listen for push notification click / open events
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        try {
          const additionalData: any = event.notification.additionalData || {};
          const tab = additionalData?.tab;
          const filter = additionalData?.filter;

          if (onNavigate && tab) {
            onNavigate(tab, filter);
            return;
          }

          // Route to appropriate tab in mobil app
          if (tab === 'notes' || tab === 'reminders') {
            router.push('/(tabs)/reminders' as any);
          } else if (tab === 'returns') {
            router.push('/(tabs)/returns' as any);
          } else if (tab === 'services') {
            router.push('/(tabs)/services' as any);
          } else if (tab === 'installations') {
            router.push('/(tabs)/installations' as any);
          } else if (tab === 'attendance' || tab === 'staff_tracking') {
            router.push('/(tabs)/attendance' as any);
          }
        } catch (e) {
          console.warn('OneSignal notification click error:', e);
        }
      });
    } catch (err) {
      console.warn('OneSignal init error:', err);
    }
  },

  /**
   * Firmly links the current logged-in user to OneSignal external_id and tags
   */
  async login(user: { id: string; name?: string; role?: string; companyCode?: string }) {
    if (Platform.OS === 'web' || !user?.id) return;
    try {
      if (!this.initialized) this.init();
      OneSignal.login(user.id);

      const tags: Record<string, string> = {
        userId: user.id,
        name: user.name || 'Personel',
        role: user.role || 'user',
        company_code: (user.companyCode || 'POLATLAR').toUpperCase(),
        platform: Platform.OS,
      };
      OneSignal.User.addTags(tags);
      OneSignal.User.addAlias('user_id', user.id);
      if ((user as any).username) {
        OneSignal.User.addAlias('username', (user as any).username);
      }
    } catch (err) {
      console.warn('OneSignal login error:', err);
    }
  },

  /**
   * Unlinks the user on logout
   */
  logout() {
    if (Platform.OS === 'web') return;
    try {
      OneSignal.logout();
    } catch (err) {
      console.warn('OneSignal logout error:', err);
    }
  },

  /**
   * Sends a real push notification via Vercel proxy / OneSignal cloud API
   */
  async sendTestPushNotification(params: {
    userId?: string;
    targetUserIds?: string[];
    title?: string;
    message?: string;
    delaySeconds?: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const targets = new Set<string>();
      if (params.userId) targets.add(params.userId);
      if (params.targetUserIds) {
        params.targetUserIds.forEach((t) => {
          if (t && t.trim()) targets.add(t.trim());
        });
      }

      const response = await fetch('https://saha-takip-beige.vercel.app/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: params.title || '🔔 Donanım Bildirim Testi',
          message: params.message || 'Bildirim sisteminiz telefonunuzda başarıyla aktif!',
          targetUserIds: Array.from(targets),
          delaySeconds: params.delaySeconds || 0,
          data: { tab: 'reminders' },
        }),
      });

      const data = await response.json();
      if (data && data.id) {
        return { success: true };
      }
      return { success: false, error: data?.errors?.[0] || 'Bildirim gönderilemedi' };
    } catch (err: any) {
      console.warn('sendTestPushNotification error:', err);
      return { success: false, error: err?.message };
    }
  },
};
