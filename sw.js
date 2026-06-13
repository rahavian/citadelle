/* Service worker — Citadel Guide Namur.
 * Met en cache la coquille (interface + tous les textes embarqués) pour un
 * fonctionnement hors-ligne (PRD §12). Les médias déposés par l'utilisateur
 * vivent en localStorage, hors du cache ; les futures photos réseau seront
 * servies réseau-d'abord avec repli au cache. */
const CACHE = 'citadelle-v6';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/image-slot.js',
  './data/content.js',
  './data/uploads.json',
  './manifest.webmanifest',
  './assets/hero-caricature.png',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API d'authoring : jamais interceptée ni mise en cache (écritures, mapping live).
  if (url.origin === location.origin && url.pathname.includes('/api/')) return;

  // Mapping des uploads : réseau-d'abord (toujours frais), repli cache hors-ligne.
  if (url.origin === location.origin && url.pathname.endsWith('/data/uploads.json')) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  // Polices Google : réseau-d'abord, repli cache (best effort, hors-ligne = repli système).
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Coquille & même origine : cache-d'abord, repli réseau (puis on met en cache).
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
