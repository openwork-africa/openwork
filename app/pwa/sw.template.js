// Openwork service worker, stamped at build by pwa/stamp-sw.ts.
//
// App-shell model: each build's worker precaches that build's whole app, so an open tab keeps working offline and
// after a deploy. A new worker installs in the background and WAITS; it takes over only when the page asks
// (SKIP_WAITING, from the "Update" notice) or when every tab is closed. Never skipWaiting on install.
const VERSION = "__BUILD_VERSION__";
const PRECACHE = __PRECACHE__;
const SHELL_CACHE = `openwork-shell-${VERSION}`;
const FILE_CACHE = "openwork-files";
const SHELL = "/index.html";
const precached = new Set(PRECACHE);
// Every path that is not a file and not the server's own is a page of the app.
const isAppPage = (pathname) => !/\.[a-z0-9]+$/i.test(pathname) && !pathname.startsWith("/api/") && pathname !== "/healthz";
const FILE_GET = /^\/api\/files\/[^/]+$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, FILE_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("openwork-") && !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (!isAppPage(url.pathname)) return;
    event.respondWith(caches.match(SHELL, { cacheName: SHELL_CACHE }).then((cached) => cached ?? fetch(request)));
    return;
  }

  if (precached.has(url.pathname)) {
    event.respondWith(caches.match(url.pathname, { cacheName: SHELL_CACHE }).then((cached) => cached ?? fetch(request)));
    return;
  }

  if (FILE_GET.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FILE_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});

