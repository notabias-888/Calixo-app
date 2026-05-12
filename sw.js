// Calixo v10 — Service Worker
// Strategy:
//   HTML        → network-first  (always fetches fresh; offline falls back to cache)
//   CDN assets  → cache-first    (icons, html2canvas — stable, never change)
//   Everything  → network-first  (API calls, etc.)
//
// To force a full cache reset on next deploy: bump CACHE below (e.g. calixo-v11).
// HTML changes alone do NOT require a CACHE bump — network-first handles them.

const CACHE = 'calixo-v10';

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/fonts/tabler-icons.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

// ── Install: pre-cache CDN assets only (HTML fetched fresh on demand) ───────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(CDN_ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
});

// ── Activate: delete ALL old caches, then claim clients immediately ──────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET' || url.startsWith('chrome-extension')) return;

  const isHTML = url.endsWith('/index.html') || url.endsWith('/');
  const isCDN  = url.includes('tabler-icons') || url.includes('html2canvas');

  if (isHTML) {
    // Network-first: always try server → update cache → return fresh response.
    // Falls back to cached version only when offline.
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  if (isCDN) {
    // Cache-first: stable CDN assets don't change.
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

  // Network-first fallback for everything else.
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
