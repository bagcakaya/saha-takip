importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'saha-takip-pwa-v16';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/favicon.png',
  '/icon.png',
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((res) => (res && res.ok ? cache.put(url, res) : undefined))
            .catch(() => {})
        )
      );
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      try {
        const notifs = await self.registration.getNotifications();
        notifs.forEach((n) => {
          if (
            n.tag === 'saha-takip-badge' ||
            (n.body && n.body.includes('bekleyen bildirim')) ||
            (n.title === 'İş Takip' && n.body && n.body.includes('bekleyen'))
          ) {
            n.close();
          }
        });
      } catch (e) {
        // ignore
      }
      await self.clients.claim();
    })()
  );
});

// Fetch Event (iOS Safari / WebKit safe, never serves stale HTML or poisoned MIME types)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const reqUrl = new URL(event.request.url);
  // Never intercept API calls
  if (reqUrl.pathname.startsWith('/api/')) return;

  const accept = event.request.headers.get('accept') || '';
  const isNavigate =
    event.request.mode === 'navigate' ||
    accept.includes('text/html') ||
    reqUrl.pathname === '/' ||
    reqUrl.pathname === '/index.html';
  const isJsOrCss = /\.(js|mjs|css)(\?.*)?$/i.test(reqUrl.pathname);

  if (isNavigate) {
    event.respondWith(
      (async () => {
        try {
          // Fetch fresh HTML via URL string (safe on iOS Safari WebKit & bypasses stale HTTP cache)
          const freshResponse = await fetch(event.request.url, {
            cache: 'no-store',
            credentials: 'same-origin',
          });
          const ct = (freshResponse.headers.get('content-type') || '').toLowerCase();
          if (freshResponse && freshResponse.status === 200 && ct.includes('text/html')) {
            const clone = freshResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', clone).catch(() => {});
            }).catch(() => {});
            return freshResponse;
          }
          return freshResponse;
        } catch (err) {
          try {
            const fallbackFetch = await fetch(event.request);
            if (fallbackFetch && fallbackFetch.status === 200) return fallbackFetch;
          } catch {}
          const cachedHtml =
            (await caches.match('/index.html')) || (await caches.match(event.request));
          if (cachedHtml) return cachedHtml;
          throw err;
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        const ct = (response.headers.get('content-type') || '').toLowerCase();

        // Guard against SPA rewrite returning text/html for missing hashed .js/.css bundles
        if (isJsOrCss && ct.includes('text/html')) {
          return new Response('/* asset outdated */', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' },
          });
        }

        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {});
          }).catch(() => {});
        }
        return response;
      } catch (err) {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          const cachedCt = (cachedResponse.headers.get('content-type') || '').toLowerCase();
          if (!(isJsOrCss && cachedCt.includes('text/html'))) {
            return cachedResponse;
          }
        }
        throw err;
      }
    })()
  );
});

// Helper to normalize any tab alias to canonical TabType
function normalizeWorkerTab(raw) {
  if (!raw) return null;
  const clean = String(raw).trim().toLowerCase().replace(/-/g, '_');
  const aliases = {
    home: 'home',
    dashboard: 'home',
    anasayfa: 'home',
    installations: 'installations',
    kurulumlar: 'installations',
    montaj: 'installations',
    services: 'services',
    servisler: 'services',
    notes: 'notes',
    notlar: 'notes',
    is_emirleri: 'notes',
    staff_tracking: 'staff_tracking',
    stafftracking: 'staff_tracking',
    personel: 'staff_tracking',
    izin: 'staff_tracking',
    timed_follow_ups: 'timed_follow_ups',
    timedfollowups: 'timed_follow_ups',
    sureli_takip: 'timed_follow_ups',
    surelitakip: 'timed_follow_ups',
    alarm: 'timed_follow_ups',
    alarmlar: 'timed_follow_ups',
    reminders: 'reminders',
    admin_reminders: 'reminders',
    adminreminders: 'reminders',
    returns: 'returns',
    iade: 'returns',
    garanti: 'returns',
    branches: 'branches',
    subeler: 'branches',
    logs: 'logs',
    guvenlik: 'logs',
    personal_notes: 'personal_notes',
    personalnotes: 'personal_notes',
    kisisel_notlar: 'personal_notes',
    kisiselnotlar: 'personal_notes',
    notlarim: 'personal_notes',
    template: 'template',
    sablon: 'template',
  };
  return aliases[clean] || null;
}

// Helper to detect tab from notification text if not provided
function detectWorkerTab(title, body) {
  const text = `${title || ''} ${body || ''}`.toLowerCase();
  if (text.includes('kişisel not') || text.includes('kisisel not') || text.includes('notlarım') || text.includes('notlarim')) {
    return { tab: 'personal_notes' };
  }
  if (text.includes('süreli takip') || text.includes('sureli takip') || text.includes('⏰') || text.includes('alarm') || text.includes('cari takip')) {
    return { tab: 'timed_follow_ups' };
  }
  if (text.includes('izin') || text.includes('işe başladı') || text.includes('mesai') || text.includes('personel')) {
    return { tab: 'staff_tracking' };
  }
  if (text.includes('iş emri') || text.includes('onay bekliyor') || text.includes('📋')) {
    let filter = 'pending';
    if (text.includes('onaylandı')) filter = 'approved';
    if (text.includes('reddedildi')) filter = 'rejected';
    return { tab: 'notes', filter };
  }
  if (text.includes('kurulum') || text.includes('montaj')) {
    return { tab: 'installations' };
  }
  if (text.includes('servis') || text.includes('arıza') || text.includes('bakım')) {
    return { tab: 'services' };
  }
  if (text.includes('iade') || text.includes('garanti') || text.includes('🛡️')) {
    return { tab: 'returns' };
  }
  if (text.includes('talimat') || text.includes('hatırlatıcı') || text.includes('📢') || text.includes('📌')) {
    return { tab: 'reminders' };
  }
  if (text.includes('şube') || text.includes('sube')) {
    return { tab: 'branches' };
  }
  if (text.includes('güvenlik') || text.includes('log')) {
    return { tab: 'logs' };
  }
  return { tab: 'home' };
}

// Notification Click Event (Direct Deep-Linking to Tab / Filter)
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  notification.close();

  const data = notification.data || {};
  const additionalData = data.additionalData || data.custom?.a || {};
  let targetUrl =
    notification.launchURL ||
    notification.launchUrl ||
    data.url ||
    data.launchURL ||
    data.custom?.u ||
    additionalData.url ||
    additionalData.launchURL ||
    '';

  let rawTab = data.tab || additionalData.tab;
  let filter = data.filter || additionalData.filter;

  if (!rawTab && targetUrl && targetUrl !== '/') {
    try {
      const parsed = new URL(targetUrl, self.location.origin);
      rawTab = parsed.searchParams.get('tab');
      if (!filter) filter = parsed.searchParams.get('filter');
    } catch (e) {}
  }

  let tab = normalizeWorkerTab(rawTab);

  // Content-based fallback if tab is still missing
  if (!tab) {
    const detected = detectWorkerTab(notification.title, notification.body);
    tab = detected.tab;
    if (!filter && detected.filter) filter = detected.filter;
  }

  // Construct definitive target URL with query params
  const origin = self.location.origin;
  const finalUrl = new URL(targetUrl && targetUrl !== '/' ? targetUrl : '/', origin);
  finalUrl.searchParams.set('tab', tab);
  if (filter) {
    finalUrl.searchParams.set('filter', filter);
  }
  const finalUrlStr = finalUrl.toString();

  // Instant cross-process BroadcastChannel message to any active/suspended PWA window
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('saha_takip_channel');
      bc.postMessage({
        type: 'saha:navigate',
        tab,
        filter: filter || '',
        url: finalUrlStr,
      });
      setTimeout(() => bc.close(), 1000);
    }
  } catch (e) {}

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'saha:navigate',
            tab,
            filter: filter || '',
            url: finalUrlStr,
          });
          if ('navigate' in client) {
            try {
              client.navigate(finalUrlStr);
            } catch (e) {}
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(finalUrlStr);
      }
    })
  );
});

// App Badging API: Foreground App -> Service Worker badge synchronization
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'saha:set-badge' || event.data.type === 'saha:clear-badge-notifications') {
    const count = Number(event.data.count) || 0;
    
    // 1. Desktop & iOS W3C Badging API (only icon counter, no tray popups)
    if (typeof self.navigator !== 'undefined' && 'setAppBadge' in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }

    // 2. Firmly purge any lingering tray notifications with tag 'saha-takip-badge' or containing 'bekleyen bildirim'
    try {
      const activeNotifs = await self.registration.getNotifications();
      activeNotifs.forEach((n) => {
        if (
          n.tag === 'saha-takip-badge' ||
          (n.body && n.body.includes('bekleyen bildirim')) ||
          (n.title === 'İş Takip' && n.body && n.body.includes('bekleyen'))
        ) {
          n.close();
        }
      });
    } catch (e) {
      // ignore
    }
  }
});

// App Badging API: Background Push Notification badge count handler
self.addEventListener('push', async (event) => {
  try {
    let count = 1;
    if (event.data) {
      try {
        const json = event.data.json();
        if (json && typeof json.badge === 'number') {
          count = json.badge;
        }
      } catch (e) {}
    }
    if (typeof self.navigator !== 'undefined' && 'setAppBadge' in self.navigator) {
      self.navigator.setAppBadge(count).catch(() => {});
    }
    try {
      const activeNotifs = await self.registration.getNotifications();
      activeNotifs.forEach((n) => {
        if (
          n.tag === 'saha-takip-badge' ||
          (n.body && n.body.includes('bekleyen bildirim')) ||
          (n.title === 'İş Takip' && n.body && n.body.includes('bekleyen'))
        ) {
          n.close();
        }
      });
    } catch (e) {}
  } catch (err) {}
});

