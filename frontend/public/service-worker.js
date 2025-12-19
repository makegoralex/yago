const CACHE_NAME = 'yago-pos-cache-v2';
const APP_SHELL = [
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  if (request.url.includes('/api/catalog') || request.url.includes('/api/orders')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          cache.put(request, response.clone());
          return response;
        } catch (error) {
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          return new Response('Offline', { status: 503 });
        }
      })
    );
  }

  if (request.mode === 'navigate' || request.url.endsWith('/index.html')) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
          return response;
        } catch (error) {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          return new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }

      try {
        return await fetch(request);
      } catch (error) {
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
