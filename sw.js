/* ============================================================================
 * sw.js — Service worker R·Typons (PWA).
 * Stratégie volontairement SANS chemins en dur vers les modules JS/CSS
 * (l'arborescence évolue) : on precache un shell minimal et on met en cache
 * à la volée le reste du même-origine. Tuiles carto + API adresse : réseau
 * direct (trop volumineux / dynamiques pour un cache hors-ligne utile).
 * ==========================================================================*/
var VERSION = 'rtypons-v1';
var SHELL = VERSION + '-shell';   // shell app (précaché à l'install)
var STATIC = VERSION + '-static'; // même-origine mis en cache au runtime
var CDN = VERSION + '-cdn';       // libs / polices tierces

// Shell minimal et stable — pas les modules (leurs chemins bougent).
var SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './assets/favicon.ico',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Hôtes de tuiles / données : on ne les met jamais en cache (réseau direct).
var PASS_THROUGH = [
  'data.geopf.fr',
  'wxs.ign.fr',
  'tile.openstreetmap.org',
  'tile.opentopomap.org',
  'server.arcgisonline.com',
  'api-adresse.data.gouv.fr'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      // addAll échoue en bloc si une URL manque : on tolère les absences.
      return Promise.all(SHELL_URLS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf(VERSION) !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

function isPassThrough(url) {
  return PASS_THROUGH.some(function (h) { return url.hostname.indexOf(h) !== -1; });
}

// Stale-while-revalidate : sert le cache tout de suite, rafraîchit en fond.
function staleWhileRevalidate(req, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Tuiles carto & API : réseau direct, jamais mis en cache.
  if (isPassThrough(url)) return;

  // Navigations : réseau d'abord, repli sur le shell hors-ligne.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match('./index.html').then(function (r) {
          return r || caches.match('./');
        });
      })
    );
    return;
  }

  // Même-origine (modules JS, CSS, assets) : stale-while-revalidate.
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(req, STATIC));
    return;
  }

  // Tiers (OpenLayers, proj4, Google Fonts…) : stale-while-revalidate.
  e.respondWith(staleWhileRevalidate(req, CDN));
});
