import { detectTabFromNotification, extractTabAndFilterFromUrl } from '../utils/navigationUtils';

let activeAlarmInterval: any = null;
let activeAudioCtx: any = null;

export const NotificationService = {
  /**
   * Requests browser notification permission
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      try {
        const status = await Notification.requestPermission();
        return status === 'granted';
      } catch (e) {
        console.warn('Notification permission request error:', e);
      }
    }
    return false;
  },

  /**
   * Plays a notification audio chime using Web Audio API and vibrates device
   */
  playChime(): void {
    // 1. Vibration
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch {
      // ignore
    }

    // 2. Audio Chime
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.12);
      gain2.gain.setValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn('Audio chime playback failed:', e);
    }
  },

  /**
   * Plays a repeating alarm sound pattern until stopAlarmSound is called
   */
  playAlarmSound(): void {
    this.stopAlarmSound();

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([400, 150, 400, 150, 600]);
      }
    } catch {
      // ignore
    }

    const playBeepPattern = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!activeAudioCtx || activeAudioCtx.state === 'closed') {
          activeAudioCtx = new AudioCtx();
        }
        const ctx = activeAudioCtx;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch (e) {
        console.warn('Alarm audio playback failed:', e);
      }
    };

    playBeepPattern();
    activeAlarmInterval = setInterval(playBeepPattern, 1800);
  },

  /**
   * Stops the active repeating alarm
   */
  stopAlarmSound(): void {
    if (activeAlarmInterval) {
      clearInterval(activeAlarmInterval);
      activeAlarmInterval = null;
    }
    if (activeAudioCtx) {
      try {
        activeAudioCtx.close();
      } catch {
        // ignore
      }
      activeAudioCtx = null;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(0);
      }
    } catch {
      // ignore
    }
  },

  recentNotifications: new Map<string, number>(),

  /**
   * Sends a browser / PWA service worker notification with audio chime
   * and automatic deep-linking to the relevant tab.
   * Includes 60-second deduplication cache and title normalization to prevent duplicate alerts.
   */
  async sendNotification(
    title: string,
    body: string,
    url?: string,
    options?: { tag?: string; skipIfVisible?: boolean }
  ): Promise<void> {
    if (typeof window === 'undefined') return;

    // Deduplication key: normalize title variants ("İş Emriniz" vs "İş Emri", "Kurulumunuz" vs "Kurulum")
    const normTitle = (title || '')
      .trim()
      .replace(/İş Emriniz/g, 'İş Emri')
      .replace(/Kurulumunuz/g, 'Kurulum')
      .toLowerCase();
    const normBody = (body || '').trim().toLowerCase();
    const explicitTag = options?.tag ? options.tag.trim() : '';
    const dedupKey = explicitTag || `${normTitle}:::${normBody}`;
    const now = Date.now();

    // 1. In-memory deduplication check (60s window)
    const lastSent = this.recentNotifications.get(dedupKey);
    if (lastSent && now - lastSent < 60000) {
      console.log('Skipping duplicate local notification within 60s window:', normTitle);
      return;
    }

    // 2. LocalStorage deduplication check (across tabs, workers & reloads)
    try {
      const lsKey = '@saha_recent_local_notif';
      const raw = localStorage.getItem(lsKey);
      const cache: Record<string, number> = raw ? JSON.parse(raw) : {};
      if (cache[dedupKey] && now - cache[dedupKey] < 60000) {
        console.log('Skipping duplicate local notification (cross-tab 60s):', normTitle);
        return;
      }
      cache[dedupKey] = now;
      for (const [k, ts] of Object.entries(cache)) {
        if (now - ts > 120000) delete cache[k];
      }
      localStorage.setItem(lsKey, JSON.stringify(cache));
    } catch {
      // ignore
    }

    this.recentNotifications.set(dedupKey, now);
    if (this.recentNotifications.size > 50) {
      for (const [k, ts] of this.recentNotifications.entries()) {
        if (now - ts > 60000) this.recentNotifications.delete(k);
      }
    }

    this.playChime();

    // If document is actively focused and visible, in-app toast handles the alert.
    // Avoid spawning an OS desktop tray popup right over the active tab by default.
    const shouldSkipIfVisible = options?.skipIfVisible !== false;
    if (shouldSkipIfVisible && typeof document !== 'undefined' && document.visibilityState === 'visible') {
      return;
    }

    let targetUrl = url;
    let targetTab: string | null = null;
    let targetFilter: string | null = null;

    if (targetUrl && targetUrl !== '/') {
      const parsed = extractTabAndFilterFromUrl(targetUrl);
      targetTab = parsed.tab;
      targetFilter = parsed.filter;
    }

    if (!targetTab) {
      const detected = detectTabFromNotification(title, body);
      targetTab = detected.tab;
      targetFilter = detected.filter || null;
      targetUrl = targetFilter
        ? `/?tab=${targetTab}&filter=${targetFilter}`
        : `/?tab=${targetTab}`;
    }

    const payloadData = {
      url: targetUrl || `/?tab=${targetTab}`,
      tab: targetTab,
      filter: targetFilter || '',
    };

    const safeTag = explicitTag || `st-${targetTab || 'main'}-${dedupKey.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}`;

    // 1. Try via Service Worker (Best for PWA / Mobile / Background)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (reg as any).showNotification(title, {
            body,
            icon: '/icon.png',
            badge: '/favicon.png',
            vibrate: [200, 100, 200],
            tag: safeTag,
            renotify: false,
            data: payloadData,
          });
          return;
        }
      } catch (e) {
        console.warn('Service worker notification failed, trying standard Notification:', e);
      }
    }

    // 2. Fallback to standard Window Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: '/icon.png',
          badge: '/favicon.png',
          data: payloadData,
        });
        notif.onclick = () => {
          window.focus();
          window.dispatchEvent(
            new CustomEvent('saha:navigate', {
              detail: { tab: targetTab, filter: targetFilter },
            })
          );
          if (targetTab) {
            sessionStorage.setItem('@saha_takip_pending_tab', targetTab);
          }
          if (targetFilter) {
            sessionStorage.setItem('@saha_takip_pending_filter', targetFilter);
          }
        };
      } catch (e) {
        console.warn('Browser notification failed:', e);
      }
    }
  },
};
