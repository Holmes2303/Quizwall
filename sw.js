const CORE_CACHE = 'quizwall-core-v31';
const RUNTIME_CACHE = 'quizwall-runtime-v31';

// Keep install light for faster first meaningful paint.
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './default-quiz-data.js',
  './Versioninfo.txt',
  './manifest-v20260420.webmanifest',
  './QuizWallah%20Icon%2002.png',
  './QuizWalla%20ingame%20Symbol2.png',
  './icons/icon-192-v20260420.png',
  './icons/icon-512-v20260420.png',
  './icons/apple-touch-icon-v20260420.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([CORE_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => (keep.has(key) ? null : caches.delete(key)))
    ))
  );
  self.clients.claim();
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(pathname) {
  return /\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico|json)$/i.test(pathname);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!isSameOrigin(url)) return;

  // HTML: network first to avoid stale UI while developing features.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CORE_CACHE).then((cache) => cache.put('./index.html', cloned));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: stale-while-revalidate for snappy repeat loads.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkPromise = fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);

        return cached || networkPromise;
      })
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
