const CACHE_VERSION = 'phi-shell-v2';
const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/phitech-symbol.svg',
  '/labor_logs',
  '/expenses',
  '/custodies',
  '/fieldops',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      for (const url of SHELL_URLS) {
        try {
          const res = await fetch(url, { credentials: 'same-origin' });
          if (res && res.ok) {
            await cache.put(url, res.clone());
          }
        } catch {
          // Ignore individual pre-cache misses during install
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_VERSION) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

function shouldBypass(url, request) {
  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;
  const p = url.pathname;
  if (
    p.startsWith('/api/') ||
    p.startsWith('/rest/v1/') ||
    p.startsWith('/auth/v1/') ||
    p.startsWith('/realtime/v1/') ||
    p.startsWith('/_next/webpack-hmr')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (shouldBypass(url, req)) {
    return;
  }

  // Immutable Next.js static bundles & fonts/icons: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached || Response.error());
      })
    );
    return;
  }

  // HTML page navigations & Next.js RSC payloads: network-first with cache fallback
  const isNavigation = req.mode === 'navigate';
  const isRsc = req.headers.get('RSC') === '1' || url.searchParams.has('_rsc');

  if (isNavigation || isRsc) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => {
              c.put(req, copy);
              if (isNavigation) {
                c.put(url.pathname, res.clone());
              }
            });
          }
          return res;
        })
        .catch(async () => {
          const exact = await caches.match(req);
          if (exact) return exact;
          const byPath = await caches.match(url.pathname);
          if (byPath) return byPath;
          if (isNavigation) {
            const rootFallback = await caches.match('/');
            if (rootFallback) return rootFallback;
          }
          return Response.error();
        })
    );
  }
});
