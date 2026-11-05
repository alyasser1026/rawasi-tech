const CACHE_VERSION = 'phi-shell-v3';
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
            if (key.startsWith('phi-shell-') && key !== CACHE_VERSION) {
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

async function fetchWithCacheCopies(request, keys) {
  const response = await fetch(request);
  if (!response.ok) return { response };

  // Take every copy before returning the original response to the browser.
  const entries = keys.map((key) => [key, response.clone()]);
  const cacheWrite = caches.open(CACHE_VERSION).then((cache) =>
    Promise.all(entries.map(([key, copy]) => cache.put(key, copy)))
  );
  return { response, cacheWrite };
}

function respondAndKeepCacheAlive(event, result, onError) {
  event.waitUntil(result.then(({ cacheWrite }) => cacheWrite).catch(() => {}));
  event.respondWith(result.then(({ response }) => response).catch(onError));
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
    const result = caches.match(req).catch(() => undefined).then((cached) =>
      cached ? { response: cached } : fetchWithCacheCopies(req, [req])
    );
    respondAndKeepCacheAlive(event, result, () => Response.error());
    return;
  }

  // HTML page navigations & Next.js RSC payloads: network-first with cache fallback
  const isNavigation = req.mode === 'navigate';
  const isRsc = req.headers.get('RSC') === '1' || url.searchParams.has('_rsc');

  if (isNavigation || isRsc) {
    const result = fetchWithCacheCopies(req, isNavigation ? [req, url.pathname] : [req]);
    respondAndKeepCacheAlive(event, result, async () => {
      const exact = await caches.match(req);
      if (exact) return exact;
      if (isNavigation) {
        const byPath = await caches.match(url.pathname);
        if (byPath) return byPath;
        const rootFallback = await caches.match('/');
        if (rootFallback) return rootFallback;
      }
      return Response.error();
    });
  }
});
