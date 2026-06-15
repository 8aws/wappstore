/* WAppStore service worker — app shell + offline launcher */
const CACHE = 'wappstore-v1';
const SHELL = [
  '/',
  '/launcher.html',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/i18n.js',
  '/js/nav.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;          // no tocar recursos externos
  if (url.pathname.startsWith('/api/')) return;        // la API siempre va a red (datos frescos)
  if (url.pathname.startsWith('/uploads/')) {          // logos/iconos: cache-first
    e.respondWith(caches.match(request).then(r => r || fetchAndCache(request)));
    return;
  }
  // Shell y estáticos: red primero, con respaldo a caché si no hay conexión
  e.respondWith(
    fetch(request)
      .then(resp => { cachePut(request, resp.clone()); return resp; })
      .catch(() => caches.match(request).then(r => r || caches.match('/launcher.html')))
  );
});

function fetchAndCache(request) {
  return fetch(request).then(resp => { cachePut(request, resp.clone()); return resp; });
}
function cachePut(request, resp) {
  if (resp && resp.ok) caches.open(CACHE).then(c => c.put(request, resp));
}
