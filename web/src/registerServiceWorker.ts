export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/OneSignalSDKWorker.js', { scope: '/' })
        .then((reg) => {
          console.log('PWA Service Worker aktif:', reg.scope);
          // Check for worker updates
          if (reg && reg.update) {
            reg.update().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('PWA Service Worker kayıt hatası:', err);
        });
    });
  }
}
