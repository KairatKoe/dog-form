const CACHE_VERSION = "v3"; // <- увеличивай, когда хочешь форс-обновление
const CACHE_NAME = `tnr-form-${CACHE_VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// Установка: кэшируем основу
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS);
      await self.skipWaiting();
    })()
  );
});

// Активация: очищаем старые кэши
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch:
// - HTML (навигация): network-first (чтобы обновления приходили)
// - Статика: stale-while-revalidate (быстро, но обновляется в фоне)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Только для нашего origin
  if (url.origin !== self.location.origin) return;

  // Навигация (переходы/открытие приложения)
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }

  // Для статики
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || caches.match("./index.html");
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(async (resp) => {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("Offline", { status: 503 });
}
