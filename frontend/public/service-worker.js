const APP_CACHE_PREFIXES = ['yago-', 'workbox-precache'];

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheKeys) {
        return Promise.all(
          cacheKeys
            .filter(function (cacheKey) {
              return APP_CACHE_PREFIXES.some(function (prefix) {
                return cacheKey.indexOf(prefix) === 0;
              });
            })
            .map(function (cacheKey) {
              return caches.delete(cacheKey);
            })
        );
      })
      .then(function () {
        return self.registration.unregister();
      })
  );
});
