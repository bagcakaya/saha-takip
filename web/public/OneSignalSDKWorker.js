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

// Notification Click Event (Direct Deep-Linking to Tab / Filter)
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  notification.close();

  const data = notification.data || {};
  const additionalData = data.additionalData || data.custom?.a || {};
  const targetUrl =
    notification.launchURL ||
    notification.launchUrl ||
    data.url ||
    data.launchURL ||
    data.custom?.u ||
    additionalData.url ||
    additionalData.launchURL ||
    '/';

  let tab = data.tab || additionalData.tab;
  let filter = data.filter || additionalData.filter;

  if (!tab && targetUrl && targetUrl !== '/') {
    try {
      const parsed = new URL(targetUrl, self.location.origin);
      tab = parsed.searchParams.get('tab');
      filter = parsed.searchParams.get('filter');
    } catch (e) {}
  }

  if (!tab) {
    tab = 'notes';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'saha:navigate',
            tab,
            filter: filter || '',
            url: targetUrl,
          });
          if ('navigate' in client && targetUrl && targetUrl !== '/') {
            try {
              client.navigate(targetUrl);
            } catch (e) {}
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
