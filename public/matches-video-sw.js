const CACHE_NAME = 'matches-video-hls-v1';
const CACHEABLE_EXTENSIONS = ['.m3u8', '.ts', '.m4s', '.mp4'];

const isCacheableRequest = (request) => {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  return CACHEABLE_EXTENSIONS.some((extension) => url.pathname.endsWith(extension));
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('matches-video-hls-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isCacheableRequest(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        event.waitUntil(
          (async () => {
            try {
              const freshResponse = await fetch(request);
              if (freshResponse && freshResponse.ok) {
                await cache.put(request, freshResponse.clone());
              }
            } catch {
              // Keep serving the cached response when the network is unavailable.
            }
          })()
        );

        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          event.waitUntil(cache.put(request, networkResponse.clone()));
        }
        return networkResponse;
      } catch {
        return cachedResponse || Response.error();
      }
    })()
  );
});