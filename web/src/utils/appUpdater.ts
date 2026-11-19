import { useState, useEffect, useCallback } from 'react';

const extractBundleSignature = (html: string): string | null => {
  const match = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
  return match ? match[0] : null;
};

const getCurrentLoadedBundleSignature = (): string | null => {
  if (typeof document === 'undefined') return null;
  const scripts = Array.from(document.querySelectorAll('script[src]'));
  for (const s of scripts) {
    const src = s.getAttribute('src') || '';
    const match = src.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    if (match) return match[0];
  }
  return null;
};

/**
 * Verifies the server is reachable and serving a valid HTML + JS bundle BEFORE
 * clearing PWA Cache Storage, then forces Service Worker update and navigates
 * with a cache-busting parameter so the user immediately gets the latest version
 * without ever landing on a blank white screen.
 */
export async function forceHardRefresh(): Promise<void> {
  if (typeof window === 'undefined') return;

  // 0. Pre-flight reachability check so we NEVER wipe a working offline cache
  //    when the network is down or blocked (e.g. ISP filter).
  try {
    const checkRes = await fetch(`${window.location.origin}/index.html?_check=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    if (!checkRes.ok) {
      throw new Error(`HTTP ${checkRes.status}`);
    }
    const html = await checkRes.text();
    if (!html.includes('id="root"')) {
      throw new Error('Geçersiz HTML yanıtı');
    }
    const remoteSig = extractBundleSignature(html);
    if (remoteSig) {
      const assetRes = await fetch(`${window.location.origin}${remoteSig}`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      const ct = (assetRes.headers.get('content-type') || '').toLowerCase();
      if (!assetRes.ok || ct.includes('text/html')) {
        throw new Error('Yeni sürüm dosyaları henüz hazır değil');
      }
    }
  } catch (err) {
    console.warn('Sunucu erişim kontrolü başarısız, önbellek korunuyor:', err);
    window.alert(
      'Sunucuya şu an erişilemiyor veya yeni sürüm yayına alınıyor. Lütfen birkaç saniye sonra tekrar deneyin.'
    );
    return;
  }

  try {
    // 1. Clear all Cache Storage entries (PWA / Service Worker caches)
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch (e) {
    console.warn('Cache clear warning:', e);
  }

  try {
    // 2. Force Service Worker update & skipWaiting
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            await reg.update();
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          } catch {}
        })
      );
    }
  } catch (e) {
    console.warn('ServiceWorker update warning:', e);
  }

  // 3. Navigate with cache-busting query param so Chrome PWA never reuses stale HTTP-cached '/'
  try {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('_u', String(Date.now()));
    window.location.replace(nextUrl.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * React hook that detects when a new build/deployment is available on the server
 * and provides a 1-click hard refresh handler.
 */
export function useAppUpdateDetector() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const currentSig = getCurrentLoadedBundleSignature();
    if (!currentSig) return; // Dev server (Vite HMR) has no /assets/index-*.js

    try {
      const res = await fetch(`${window.location.origin}/index.html?_v=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Pragma: 'no-cache',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      if (!res.ok) return;
      const html = await res.text();
      const remoteSig = extractBundleSignature(html);
      if (remoteSig && remoteSig !== currentSig) {
        setUpdateAvailable(true);
      }
    } catch {
      // Offline or transient network error
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
    const interval = setInterval(checkForUpdate, 45000);

    const handleFocusOrVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    window.addEventListener('online', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusOrVisible);
      window.removeEventListener('online', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [checkForUpdate]);

  const triggerRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await forceHardRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return {
    updateAvailable,
    isRefreshing,
    triggerRefresh,
  };
}
