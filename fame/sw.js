// Einfacher Offline-Cache: App-Dateien zuerst aus dem Netz, sonst aus dem Cache.
const CACHE = 'fame-v5';
const ASSETS = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/data.js', 'js/ui.js', 'js/fx.js', 'js/diamond3d.js', 'js/particles.js',
  'vendor/three.module.min.js', 'assets/icon.svg',
  'assets/img/cash.jpg', 'assets/img/ranking.jpg', 'assets/img/pin.jpg', 'assets/img/animals.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
