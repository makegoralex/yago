import { getBuildMarker, logClientEvent } from './observability';

const SW_MIGRATION_KEY = 'yago-sw-cleanup-version';
const APP_CACHE_PREFIXES = ['yago-', 'workbox-precache'];

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result as T | null;
};

const shouldDeleteCache = (cacheKey: string): boolean => {
  return APP_CACHE_PREFIXES.some((prefix) => cacheKey.startsWith(prefix));
};

export async function unregisterLegacyServiceWorkers(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  const buildMarker = getBuildMarker();
  const previousMigrationVersion = window.localStorage.getItem(SW_MIGRATION_KEY);
  if (previousMigrationVersion === buildMarker) {
    return false;
  }

  const cleanupTask = async (): Promise<boolean> => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        const targetKeys = cacheKeys.filter(shouldDeleteCache);
        await Promise.all(targetKeys.map((cacheKey) => window.caches.delete(cacheKey)));
      }

      window.localStorage.setItem(SW_MIGRATION_KEY, buildMarker);
      logClientEvent('sw_cleanup_done', {
        buildMarker,
        previousMigrationVersion,
        reason: 'build_migration',
      });

      return true;
    } catch {
      return false;
    }
  };

  const result = await withTimeout(cleanupTask(), 1500);
  return result ?? false;
}
