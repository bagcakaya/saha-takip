import { ONESIGNAL_CONFIG } from '../constants/oneSignalConfig';
import { DeviceService } from './deviceService';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignalDeferred?: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    OneSignal?: any;
  }
}

export interface EnvironmentDetails {
  isSupported: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  platform: 'ios' | 'android' | 'desktop';
}

export function detectEnvironment(): EnvironmentDetails {
  if (typeof window === 'undefined') {
    return {
      isSupported: false,
      isIOS: false,
      isAndroid: false,
      isStandalone: false,
      platform: 'desktop',
    };
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const platform: 'ios' | 'android' | 'desktop' = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    document.referrer.includes('android-app://');
  const isSupported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
  return { isSupported, isIOS, isAndroid, isStandalone, platform };
}

export interface SubscriptionDetails {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  subscriptionId: string | null;
  userId: string | null;
  isStandalone: boolean;
  platform: 'ios' | 'android' | 'desktop';
  serviceWorkerActive: boolean;
  lastHealedAt?: string | null;
  deviceId?: string;
  deviceName?: string;
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
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });

      // Listen for notification click events for deep linking
      if (OneSignal.Notifications && OneSignal.Notifications.addEventListener) {
        OneSignal.Notifications.addEventListener('click', (event: any) => {
          try {
            console.log('OneSignal notification click event received:', event);
            const notification = event?.notification;
            const additionalData = notification?.additionalData || event?.result?.additionalData || {};
            const launchUrl =
              notification?.launchURL ||
              notification?.launchUrl ||
              event?.result?.url ||
              additionalData?.url ||
              additionalData?.launchURL;

            let tab = additionalData?.tab;
            let filter = additionalData?.filter;

            if (!tab && launchUrl) {
              try {
                const parsed = new URL(launchUrl, window.location.origin);
                tab = parsed.searchParams.get('tab');
                filter = parsed.searchParams.get('filter');
              } catch {
                // ignore
              }
            }

            if (!tab) {
              tab = 'notes';
            }

            window.dispatchEvent(
              new CustomEvent('saha:navigate', { detail: { tab, filter } })
            );

            sessionStorage.setItem('@saha_takip_pending_tab', tab);
            if (filter) {
              sessionStorage.setItem('@saha_takip_pending_filter', filter);
            }
          } catch (e) {
            console.warn('OneSignal notification click error:', e);
          }
        });
      }

      // Keep push subscription persistently synced and active across token refreshes
      const pushSubObj = OneSignal?.User?.PushSubscription || OneSignal?.User?.pushSubscription;
      if (pushSubObj && pushSubObj.addEventListener) {
        pushSubObj.addEventListener('change', async (event: any) => {
          console.log('OneSignal push aboneliği güncellendi:', event);
          try {
            const currentSubId = event?.current?.id || pushSubObj.id;
            if (currentSubId) {
              localStorage.setItem('@saha_takip_last_sub_id', currentSubId);
              window.dispatchEvent(
                new CustomEvent('saha:push-subscription-changed', {
                  detail: { subscriptionId: currentSubId },
                })
              );
            }
            const storedUser = localStorage.getItem('@gorev_tamamlama_auth_user');
            if (storedUser) {
              const u = JSON.parse(storedUser);
              if (u && u.id) {
                await OneSignal.login(u.id);
                if (OneSignal.User && OneSignal.User.addTags) {
                  await OneSignal.User.addTags({ userId: u.id, role: u.role, name: u.name });
                }
                DeviceService.syncCurrentDevice({
                  user: u,
                  pushSubscriptionId: currentSubId || null,
                  pushStatus: currentSubId ? 'connected' : 'pending',
                }).catch(() => {});
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
  loginUser(userId: string, name: string, role: string, companyCode?: string): void {
    if (typeof window === 'undefined') return;

    const compCode = (companyCode || localStorage.getItem('@saha_takip_company_code') || 'POLATLAR').toUpperCase();

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.login(userId);
        if (OneSignal.User && OneSignal.User.addTags) {
          await OneSignal.User.addTags({ name, role, userId, company_code: compCode });
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
   * Automatic Self-Healing subscription check:
   * 1. Verifies and updates service worker
   * 2. Re-opts in to push subscription so sleeping tokens are re-registered
   * 3. Binds user ID login and multi-tag identity (userId, role, name, platform, standalone)
   * 4. Persists hardware subscription ID into local storage cache
   */
  async selfHealSubscription(user?: { id: string; name: string; role: string }): Promise<SubscriptionDetails> {
    if (typeof window === 'undefined') {
      return {
        isSupported: false,
        permission: 'unsupported',
        isSubscribed: false,
        subscriptionId: null,
        userId: null,
        isStandalone: false,
        platform: 'desktop',
        serviceWorkerActive: false,
      };
    }

    const env = detectEnvironment();

    // 1. Service Worker Health Check & Update
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.update) {
          reg.update().catch(() => {});
        }
      } catch (e) {
        console.warn('SW self-heal check:', e);
      }
    }

    // 2. Firmly ensure SDK push opt-in, user identity login and hardware tags
    return new Promise((resolve) => {
      const fallbackResolve = async () => {
        const details = await this.getSubscriptionDetails();
        resolve(details);
      };

      const timer = setTimeout(fallbackResolve, 2500);

      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        clearTimeout(timer);
        try {
          // If browser granted permission, force push opt-in so push token doesn't sleep
          const pushSubObj = OneSignal?.User?.PushSubscription || OneSignal?.User?.pushSubscription;
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            if (pushSubObj?.optIn) {
              const optedIn = pushSubObj.optedIn;
              if (!optedIn) {
                await pushSubObj.optIn();
              }
            }
          }

          // Resolve target user identity
          let targetUser = user;
          if (!targetUser) {
            try {
              const stored = localStorage.getItem('@gorev_tamamlama_auth_user');
              if (stored) targetUser = JSON.parse(stored);
            } catch {
              // ignore
            }
          }

          const subId =
            pushSubObj?.id ||
            pushSubObj?.token ||
            localStorage.getItem('@saha_takip_last_sub_id') ||
            null;

          if (subId) {
            try {
              localStorage.setItem('@saha_takip_last_sub_id', subId);
              localStorage.setItem('@saha_takip_last_healed', new Date().toISOString());
              if (targetUser?.id) {
                localStorage.setItem(`@saha_takip_sub_${targetUser.id}`, subId);
              }
            } catch {
              // ignore
            }
          }

          if (targetUser?.id && OneSignal?.login) {
            await OneSignal.login(targetUser.id);
            const compCode = (
              (targetUser as any)?.companyCode ||
              localStorage.getItem('@saha_takip_company_code') ||
              'POLATLAR'
            ).toUpperCase();

            if (OneSignal?.User?.addTags) {
              await OneSignal.User.addTags({
                userId: targetUser.id,
                name: targetUser.name,
                role: targetUser.role,
                company_code: compCode,
                platform: env.platform,
                standalone: env.isStandalone ? 'true' : 'false',
                lastHealed: new Date().toISOString(),
              });
            }

            // Sync with central Device Registry
            DeviceService.syncCurrentDevice({
              user: targetUser,
              pushSubscriptionId: subId,
              pushStatus: subId
                ? 'connected'
                : typeof Notification !== 'undefined' && Notification.permission === 'denied'
                ? 'denied'
                : 'pending',
            }).catch(() => {});
          }

          const details = await this.getSubscriptionDetails();
          resolve(details);
        } catch (e) {
          console.warn('OneSignal selfHeal error:', e);
          fallbackResolve();
        }
      });
    });
  },

  /**
   * Retrieves current push subscription details for diagnostics
   */
  async getSubscriptionDetails(): Promise<SubscriptionDetails> {
    const env = detectEnvironment();
    const swActive =
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      !!navigator.serviceWorker.controller;
    const lastHealed =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('@saha_takip_last_healed')
        : null;
    const deviceId = DeviceService.getCurrentDeviceId();
    const deviceName = DeviceService.getCurrentDeviceName();

    const fallback: SubscriptionDetails = {
      isSupported: typeof Notification !== 'undefined' && 'serviceWorker' in navigator,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      isSubscribed: false,
      subscriptionId: typeof localStorage !== 'undefined' ? localStorage.getItem('@saha_takip_last_sub_id') : null,
      userId: null,
      isStandalone: env.isStandalone,
      platform: env.platform,
      serviceWorkerActive: swActive,
      lastHealedAt: lastHealed,
      deviceId,
      deviceName,
    };

    if (typeof window === 'undefined') return fallback;

    return new Promise((resolve) => {
      // Safety timeout: Never hang more than 2.5 seconds
      const timer = setTimeout(() => {
        resolve(fallback);
      }, 2500);

      const inspect = (OneSignal: any) => {
        clearTimeout(timer);
        try {
          const isSupported =
            typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
          const permission =
            typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
          const pushSub =
            OneSignal?.User?.PushSubscription || OneSignal?.User?.pushSubscription;
          const subId =
            pushSub?.id ||
            pushSub?.token ||
            localStorage.getItem('@saha_takip_last_sub_id') ||
            null;
          const optedIn = pushSub?.optedIn ?? false;
          const isSubscribed = permission === 'granted' && (optedIn || !!subId);

          if (subId) {
            try {
              localStorage.setItem('@saha_takip_last_sub_id', subId);
            } catch {
              // ignore
            }
          }

          resolve({
            isSupported,
            permission,
            isSubscribed,
            subscriptionId: subId,
            userId: OneSignal?.User?.externalId || null,
            isStandalone: env.isStandalone,
            platform: env.platform,
            serviceWorkerActive:
              typeof navigator !== 'undefined' &&
              'serviceWorker' in navigator &&
              !!navigator.serviceWorker.controller,
            lastHealedAt: lastHealed,
            deviceId,
            deviceName,
          });
        } catch {
          resolve(fallback);
        }
      };

      if (window.OneSignal?.User) {
        inspect(window.OneSignal);
      } else {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push((OneSignal: any) => {
          inspect(OneSignal);
        });
      }
    });
  },

  /**
   * Prompts user for notification permission, opts in, and firmly re-links user tags
   */
  async requestPermission(user?: { id: string; name: string; role: string }): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. Native browser permission check first (avoids SDK hanging on already-granted)
    let hasGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';

    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      try {
        const result = await Notification.requestPermission();
        hasGranted = result === 'granted';
      } catch (err) {
        console.warn('Native requestPermission error:', err);
      }
    }

    // 2. Firmly ensure SDK push opt-in and user credentials without hanging
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(hasGranted);
      }, 3000);

      const sync = async (OneSignal: any) => {
        clearTimeout(timer);
        try {
          // If browser permission is not yet granted, try OneSignal requestPermission if available
          if (!hasGranted && OneSignal?.Notifications?.requestPermission) {
            try {
              await OneSignal.Notifications.requestPermission();
            } catch {
              // ignore
            }
          }

          // Force opt-in to wake up push subscription
          if (OneSignal?.User?.pushSubscription?.optIn) {
            try {
              await OneSignal.User.pushSubscription.optIn();
            } catch {
              // ignore
            }
          }

          // If user info is available, firmly re-login and re-tag
          if (user && OneSignal?.login) {
            try {
              await OneSignal.login(user.id);
              if (OneSignal?.User?.addTags) {
                await OneSignal.User.addTags({
                  name: user.name,
                  role: user.role,
                  userId: user.id,
                });
              }
            } catch {
              // ignore
            }
          }

          const isGranted =
            hasGranted ||
            OneSignal?.Notifications?.permission === true ||
            (typeof Notification !== 'undefined' && Notification.permission === 'granted');

          resolve(isGranted);
        } catch (e) {
          console.warn('OneSignal requestPermission sync hatası:', e);
          resolve(hasGranted);
        }
      };

      if (window.OneSignal?.User) {
        sync(window.OneSignal);
      } else {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push((OneSignal: any) => {
          sync(OneSignal);
        });
      }
    });
  },

  /**
   * Memory cache to debounce duplicate push requests within 4 seconds
   */
  recentPushRequests: new Map<string, number>(),

  /**
   * Sends a hardware push notification via OneSignal REST API directly to locked phones
   * Features: Single Canonical Dispatch, APNs collapse_id deduplication, and memory debouncing
   */
  async sendPushNotification(params: {
    title: string;
    message: string;
    targetMode?: 'all' | 'custom' | 'self' | 'admin';
    targetUserIds?: string[];
    targetSubscriptionIds?: string[];
    companyCode?: string;
    url?: string;
    sendAfter?: string;
    delaySeconds?: number;
    collapseId?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const {
      title,
      message,
      targetMode = 'all',
      targetUserIds = [],
      targetSubscriptionIds = [],
      companyCode,
      url,
      sendAfter,
      delaySeconds,
      collapseId: rawCollapseId,
    } = params;

    const targetCompanyCode = (
      companyCode ||
      localStorage.getItem('@saha_takip_company_code') ||
      'POLATLAR'
    ).toUpperCase();

    // If API Key or App ID is not configured, skip
    if (
      !ONESIGNAL_CONFIG.APP_ID ||
      ONESIGNAL_CONFIG.APP_ID === 'YOUR_ONESIGNAL_APP_ID' ||
      !ONESIGNAL_CONFIG.REST_API_KEY ||
      ONESIGNAL_CONFIG.REST_API_KEY === 'YOUR_ONESIGNAL_REST_API_KEY'
    ) {
      return { success: false, error: 'OneSignal yapılandırması eksik.' };
    }

    if (targetMode === 'self') return { success: true };

    const cleanIds = Array.isArray(targetUserIds)
      ? targetUserIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    const cleanSubIds = Array.isArray(targetSubscriptionIds)
      ? targetSubscriptionIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    // Short-term deduplication cache (4-second window) to block rapid repeated clicks / double-calls
    const dedupKey = `${title}__${message}__${targetMode}__${cleanIds.slice().sort().join(',')}__${targetCompanyCode}`;
    const now = Date.now();
    const lastSent = this.recentPushRequests.get(dedupKey);
    if (lastSent && now - lastSent < 4000) {
      console.log('Skipping duplicate push notification within 4s debounce window:', dedupKey);
      return { success: true, data: { deduped: true } };
    }
    this.recentPushRequests.set(dedupKey, now);
    if (this.recentPushRequests.size > 100) {
      for (const [k, v] of this.recentPushRequests.entries()) {
        if (now - v > 30000) this.recentPushRequests.delete(k);
      }
    }

    // Collect any cached hardware player IDs for target user IDs
    const cachedSubIds: string[] = [];
    if (typeof localStorage !== 'undefined') {
      cleanIds.forEach((uid) => {
        const cached = localStorage.getItem(`@saha_takip_sub_${uid}`);
        if (cached && !cleanSubIds.includes(cached)) {
          cachedSubIds.push(cached);
        }
      });
    }
    const allHardwareSubIds = Array.from(new Set([...cleanSubIds, ...cachedSubIds]));

    if (targetMode === 'custom' && cleanIds.length === 0 && allHardwareSubIds.length === 0) {
      return { success: false, error: 'Hedef kullanıcı veya cihaz belirtilmedi.' };
    }

    const targetUrl = url || 'https://saha-takip-beige.vercel.app/?tab=notes';
    let targetTab = 'notes';
    let targetFilter = '';
    try {
      const parsed = new URL(targetUrl, 'https://saha-takip-beige.vercel.app');
      targetTab = parsed.searchParams.get('tab') || 'notes';
      targetFilter = parsed.searchParams.get('filter') || '';
    } catch {
      // ignore
    }

    // Format APNs-compliant collapse_id (max 60 chars, alphanumeric + underscores)
    // Ensures iOS APNs collapses identical lock-screen notifications into 1
    let collapseId = rawCollapseId;
    if (!collapseId) {
      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
      const minuteBucket = Math.floor(Date.now() / 60000);
      collapseId = `${safeTitle}_${minuteBucket}`;
    } else {
      collapseId = collapseId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
    }

    const basePayload: Record<string, any> = {
      app_id: ONESIGNAL_CONFIG.APP_ID,
      headings: { en: title, tr: title },
      contents: { en: message, tr: message },
      web_url: targetUrl,
      app_url: targetUrl,
      data: {
        url: targetUrl,
        launchURL: targetUrl,
        tab: targetTab,
        filter: targetFilter,
      },
      chrome_web_icon: 'https://saha-takip-beige.vercel.app/icon.png',
      chrome_web_badge: 'https://saha-takip-beige.vercel.app/icon.png',
      icon: 'https://saha-takip-beige.vercel.app/icon.png',
      priority: 10,
      ttl: 259200,
      ios_sound: 'default',
      collapse_id: collapseId,
      web_push_topic: collapseId,
    };

    if (sendAfter) {
      basePayload.send_after = sendAfter;
    }
    if (delaySeconds && delaySeconds > 0) {
      basePayload.delaySeconds = delaySeconds;
    }

    try {
      // 1. Target: All subscribers of this company (Single blast by company_code)
      if (targetMode === 'all') {
        const payload = {
          ...basePayload,
          filters: [
            { field: 'tag', key: 'company_code', relation: '=', value: targetCompanyCode },
          ],
        };
        const res = await this._postNotification(payload);
        return { success: true, data: res };
      }

      // 2. Target: All admins of this company (Single blast by role=admin)
      if (targetMode === 'admin') {
        const payload = {
          ...basePayload,
          filters: [
            { field: 'tag', key: 'company_code', relation: '=', value: targetCompanyCode },
            { field: 'tag', key: 'role', relation: '=', value: 'admin' },
          ],
        };
        const res = await this._postNotification(payload);
        return { success: true, data: res };
      }

      // 3. Target: Explicit Hardware Player IDs ONLY (e.g. specific device test)
      if (cleanSubIds.length > 0 && cleanIds.length === 0) {
        const subPayload = {
          ...basePayload,
          include_player_ids: cleanSubIds,
        };
        const subRes = await this._postNotification(subPayload);
        return { success: true, data: subRes };
      }

      // 4. Target: Specific Users (Single-channel with waterfall fallback)
      if (cleanIds.length > 0) {
        // Step 4A: OneSignal external_id alias (Primary official method)
        try {
          const aliasPayload = {
            ...basePayload,
            include_aliases: { external_id: cleanIds },
            target_channel: 'push',
          };
          const aliasRes = await this._postNotification(aliasPayload);
          if (aliasRes && aliasRes.id) {
            // Successfully sent via alias! Return immediately to prevent duplicates.
            return { success: true, data: aliasRes };
          }
        } catch (aliasErr) {
          console.warn('OneSignal alias push failed, falling back to tag:', aliasErr);
        }

        // Step 4B: Tag fallback (ONLY if alias request failed)
        try {
          let tagPayload: Record<string, any>;
          if (cleanIds.length === 1) {
            tagPayload = {
              ...basePayload,
              filters: [{ field: 'tag', key: 'userId', relation: '=', value: cleanIds[0] }],
            };
          } else {
            const filterArr: any[] = [];
            cleanIds.forEach((id, idx) => {
              if (idx > 0) filterArr.push({ operator: 'OR' });
              filterArr.push({ field: 'tag', key: 'userId', relation: '=', value: id });
            });
            tagPayload = { ...basePayload, filters: filterArr };
          }
          const tagRes = await this._postNotification(tagPayload);
          if (tagRes && tagRes.id) {
            return { success: true, data: tagRes };
          }
        } catch (tagErr) {
          console.warn('OneSignal tag push failed, falling back to cached hardware ID:', tagErr);
        }

        // Step 4C: Cached Hardware Subscription fallback (ONLY if alias AND tag failed)
        if (allHardwareSubIds.length > 0) {
          try {
            const subPayload = {
              ...basePayload,
              include_player_ids: allHardwareSubIds,
            };
            const subRes = await this._postNotification(subPayload);
            if (subRes && subRes.id) {
              return { success: true, data: subRes };
            }
          } catch (subErr) {
            console.warn('OneSignal hardware fallback failed:', subErr);
          }
        }

        return { success: false, error: 'Kullanıcıya bildirim iletilemedi.' };
      }

      // 5. Fallback: Any cached hardware ID
      if (allHardwareSubIds.length > 0) {
        const subPayload = {
          ...basePayload,
          include_player_ids: allHardwareSubIds,
        };
        const subRes = await this._postNotification(subPayload);
        return { success: true, data: subRes };
      }

      return { success: false, error: 'Hedef kullanıcı veya cihaz bulunamadı.' };
    } catch (err: any) {
      console.warn('OneSignal push gönderim hatası:', err);
      return { success: false, error: err?.message || 'Bildirim iletilemedi.' };
    }
  },

  /**
   * Internal helper to post to OneSignal REST API (with serverless proxy fallback)
   */
  async _postNotification(payload: Record<string, any>): Promise<any> {
    // 1. Try serverless API proxy first (bypasses browser CORS & prevents unmount cancellation)
    try {
      const proxyRes = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data?.id) {
          return data;
        }
        if (data && data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0)) {
          const errMsg = Array.isArray(data.errors)
            ? data.errors.join(', ')
            : typeof data.errors === 'object'
            ? Object.values(data.errors).flat().join(', ')
            : String(data.errors);
          console.error('OneSignal API error from proxy:', data.errors);
          throw new Error(errMsg);
        }
        return data;
      }
    } catch (proxyErr) {
      console.warn('Proxy /api/send-notification unavailable or failed, falling back to direct REST:', proxyErr);
    }

    // 2. Direct OneSignal REST API fallback
    try {
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${ONESIGNAL_CONFIG.REST_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result?.id) {
        return result;
      }
      if (result && result.errors && (Array.isArray(result.errors) ? result.errors.length > 0 : Object.keys(result.errors).length > 0)) {
        const errMsg = Array.isArray(result.errors)
          ? result.errors.join(', ')
          : typeof result.errors === 'object'
          ? Object.values(result.errors).flat().join(', ')
          : String(result.errors);
        console.error('OneSignal API returned error:', result.errors);
        throw new Error(errMsg);
      }
      return result;
    } catch (e) {
      console.error('OneSignal REST API fetch failed:', e);
      throw e;
    }
  },
};
