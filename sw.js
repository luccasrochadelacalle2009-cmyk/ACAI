/* Açaí ERP — service worker: network-first (atualiza rápido) com fallback em cache para offline */
const CACHE = 'acai-erp-v6-2026-11-21';
const V = '?v=6';
const SHELL = [
  './', './index.html' + V, './styles.css' + V, './manifest.json' + V,
  './icon-192.png' + V, './icon-512.png' + V,
  './js/icons.js' + V, './js/core.js' + V, './js/calc.js' + V, './js/views.js' + V,
  './js/actions.js' + V, './js/app.js' + V
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nunca cacheie autenticação, dados ou bibliotecas remotas.
  if (/supabase|jsdelivr|google|gstatic/.test(url.hostname)) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html', { ignoreSearch: true });
      return Response.error();
    }))
  );
});
