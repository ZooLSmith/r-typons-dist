/* ============================================================================
 * sw.js — Service worker R·Typons (PWA minimal).
 * Choix : AUCUN cache de l'app (toujours réseau → jamais de vieille version).
 * Seules les polices/icônes Google (Material Symbols + fontes) sont mises en
 * cache car immuables (URLs versionnées). Tuiles, API, CDN, fichiers app :
 * réseau direct, pas d'interception. L'activation purge les anciens caches.
 * ==========================================================================*/
var VERSION = 'rtypons-v2';
var FONTS = VERSION + '-fonts';

// Hôtes Google Fonts / Material Symbols (contenus immuables).
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function () {
  self.skipWaiting(); // prend la main sans attendre la fermeture des onglets
});

self.addEventListener('activate', function (e) {
  // Purge TOUS les caches créés par le SW (ancien shell/app périmé inclus).
  // Le cache polices se reconstruit ensuite à la volée via le handler fetch.
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isFont(url) {
  return FONT_HOSTS.indexOf(url.hostname) !== -1;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Polices/icônes Google : cache-first (immuable). Tout le reste : on ne
  // répond pas → le navigateur fait sa requête réseau normale (jamais de
  // vieille version servie par le SW).
  if (!isFont(url)) return;

  e.respondWith(
    caches.open(FONTS).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        });
      });
    })
  );
});
