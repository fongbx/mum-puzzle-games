// Saves the app on the phone. After the first online visit, pages open from this cache.
// A newer visit updates the saved copies in the background; the next open uses them.

var CACHE = 'mum-games-v3';
var ASSETS = [
  './',
  './index.html',
  './sudoku.html',
  './blocks.html',
  './english.html',
  './manifest.webmanifest',
  './favicon.svg',
  './css/app.css',
  './js/boot.js',
  './js/settings.js',
  './js/pwa.js',
  './js/home.js',
  './js/sudoku-core.js',
  './js/sudoku.js',
  './js/blocks-core.js',
  './js/blocks.js',
  './js/english.js',
  './data/english/index.json',
  './data/english/unit-01-daily-life.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var networked = fetch(req).then(function (res) {
          if (res && res.ok && res.type === 'basic' && !res.redirected) {
            cache.put(req, res.clone());
          }
          return res;
        }).catch(function () {
          return null;
        });

        if (cached) {
          event.waitUntil(networked.catch(function () {}));
          return cached;
        }

        return networked.then(function (res) {
          if (res) return res;
          if (req.mode === 'navigate') return cache.match('./index.html');
          return Response.error();
        });
      });
    })
  );
});
