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
 * Clears PWA Cache Storage, forces Service Worker update, busts HTTP cache,
 * and reloads the application so the user immediately gets the latest version.
 */
export async function forceHardRefresh(): Promise<void> {
  if (typeof window === 'undefined') return;

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

  try {
    // 3. Bust browser HTTP cache for index.html
    await fetch(`${window.location.origin}/index.html?_refresh=${Date.now()}`, {
      cache: 'reload',
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {}

  // 4. Reload current page
  window.location.reload();
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
    await forceHardRefresh();
  }, [isRefreshing]);

  return {
    updateAvailable,
    isRefreshing,
    triggerRefresh,
  };
}
