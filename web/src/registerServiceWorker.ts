export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('PWA Service Worker aktif:', reg.scope);
        })
        .catch((err) => {
          console.warn('PWA Service Worker kayıt hatası:', err);
        });
    });
  }
}
