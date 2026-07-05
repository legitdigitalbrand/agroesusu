const CACHE_NAME = "agroesusu-v2";
const OFFLINE_URL = "/offline";

// Core routes to pre-cache on install
const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip API routes and Supabase/Paystack — always need network
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("paystack") ||
    url.hostname.includes("googleapis")
  ) {
    return;
  }

  // Network-first for pages, fall back to cache, then offline page
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          // Cache successful page responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Network-first for JS/CSS (Next.js hashes filenames per build, so a stale
  // cache-first strategy here can trap users on an old bundle). Fall back to
  // cache only if the network is unavailable.
  if (request.destination === "style" || request.destination === "script") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for images/fonts — these rarely change and don't affect UI correctness
  if (request.destination === "image" || request.destination === "font") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }
});
