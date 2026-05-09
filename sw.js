// Calixo v7 — Service Worker (cache-first, offline-first)
// Strategy:
//   - App shell (HTML) + CDN deps → cache on first load
//   - Navigations → cache-first, fall back to network
//   - Everything else → network-first

const CACHE  = 'calixo-v7';
const ASSETS = [
  './index.html',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/fonts/tabler-icons.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// ── Install: pre-cache app shell ────────────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
});

// ── Activate: delete old caches ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app shell + CDN; network-first for everything else
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip non-GET and chrome-extension requests
  if (e.request.method !== 'GET' || url.startsWith('chrome-extension')) return;

  // Cache-first: app HTML and CDN assets
  const isCacheable =
    url.endsWith('/index.html') ||
    url.endsWith('/') ||
    url.includes('tabler-icons') ||
    url.includes('html2canvas');

  if (isCacheable) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // Network-first for everything else (API calls, etc.)
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
