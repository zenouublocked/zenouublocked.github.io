/* Zenou Unblocked, service worker.
 *
 * Deliberately small: a stale shell beats a blank page when the network drops,
 * but nobody wants yesterday's catalogue forever. So:
 *   · HTML + catalogue + JSON  -> network first, cache as a fallback
 *   · CSS / JS / images        -> cache first, refreshed in the background
 *
 * Bump CACHE_VERSION when the shell changes shape.
 */
const CACHE_VERSION = 'zenou-v1';
const SHELL = [
  'index.html',
  'css/style.css',
  'css/plus.css',
  'js/zenou-plus.js',
  'js/settings.js',
  'js/atmosphere.js',
  'assets/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never touch other origins

  const networkFirst = req.mode === 'navigate'
    || /\.(html|json|webmanifest)$/i.test(url.pathname)
    || url.pathname.endsWith('/');

  if (networkFirst) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
