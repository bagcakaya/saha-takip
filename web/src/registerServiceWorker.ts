export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/OneSignalSDKWorker.js?v=6', { scope: '/' })
        .then(async (reg) => {
          console.log('PWA Service Worker aktif:', reg.scope);

          // If a waiting worker exists, tell it to take over immediately
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            }
          });

          // Check for worker updates
          if (reg && reg.update) {
            reg.update().catch(() => {});
          }

          // Firmly clean up any old lingering badge notifications from previous worker versions
          try {
            const activeNotifs = await reg.getNotifications();
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
        })
        .catch((err) => {
          console.warn('PWA Service Worker kayıt hatası:', err);
        });
    });
  }
}
