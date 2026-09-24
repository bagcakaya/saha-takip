importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = 'saha-takip-pwa-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Network First, Cache Fallback)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
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
    template: 'template',
    sablon: 'template',
  };
  return aliases[clean] || null;
}

// Helper to detect tab from notification text if not provided
function detectWorkerTab(title, body) {
  const text = `${title || ''} ${body || ''}`.toLowerCase();
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
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'saha:set-badge') {
    const count = Number(event.data.count) || 0;
    if (typeof self.navigator !== 'undefined' && 'setAppBadge' in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }
  }
});

// App Badging API: Background Push Notification badge count handler
self.addEventListener('push', (event) => {
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
  } catch (err) {}
});
