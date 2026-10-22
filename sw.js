/* Service worker – cache aplikacji i danych do pracy offline.
   Po zmianie plików w data/ podbij numer wersji, żeby telefony pobrały nowe dane. */
const VERSION = 'errlib-v1.1.0';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/tokens.css', './css/components.css', './css/app.css',
  './js/icons.js', './js/formula.js', './js/registry.js', './js/app.js',
  './data/catalog.js',
  './data/mitsubishi/mr-j4.js', './data/mitsubishi/fr-e800.js', './data/mitsubishi/fr-e800-param.js', './data/mitsubishi/qd77-devicelist.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
