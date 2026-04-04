self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheKeys) {
        return Promise.all(
          cacheKeys.map(function (cacheKey) {
            return caches.delete(cacheKey);
          })
        );
      })
      .then(function () {
        return self.registration.unregister();
      })
  );
});
