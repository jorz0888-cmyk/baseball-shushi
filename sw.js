// Minimal offline-capable service worker.
// Caches the app shell on first install, then serves cache-first.
//
// CACHE_VERSION is derived from the ?v=<BUILD_ID> query string that
// main.jsx appends when registering this SW. Each Vite build mints a
// new BUILD_ID (see vite.config.js __BUILD_ID__) so the SW URL
// changes per deploy, the browser refetches sw.js, the new SW lands
// in "installed" state, and main.jsx shows the update banner.

const url = new URL(self.location);
const VERSION = url.searchParams.get("v") || "dev";
const CACHE_VERSION = "bb-calc-" + VERSION;

const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)),
  );
  // Note: we do NOT skipWaiting here — that's the whole point. The
  // new SW sits in "waiting" until UpdateBanner postMessages
  // SKIP_WAITING below.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// Triggered by useUpdateAvailable.applyUpdate() when the user taps
// 更新する on the banner. After skipWaiting, the new SW activates,
// fires controllerchange in main.jsx, and that handler reloads.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const reqUrl = new URL(request.url);
  if (reqUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response.ok || response.type !== "basic") return response;
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match("/index.html"));
    }),
  );
});
