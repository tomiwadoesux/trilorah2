/*
 * The phone-mic page, offline.
 *
 * Once a phone has opened /mic, this keeps a copy of the page and its build
 * files, so a dead or flaky connection means a page that loads and explains
 * itself instead of a blank screen. Pairing still needs the internet — the
 * handshake goes through the cloud — and the page says so when it can't
 * reach it. Registered by MicClient with scope "/mic"; nothing else on the
 * site goes through here.
 */
const CACHE = "trilorah-mic-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  // The page itself: fresh from the network when there is one (so fixes
  // reach phones), the kept copy when there is not. The code rides in the
  // query string, so the copy is filed under plain /mic.
  if (event.request.mode === "navigate" && url.pathname === "/mic") {
    event.respondWith(
      fetch(event.request)
        .then((live) => {
          const copy = live.clone();
          void caches.open(CACHE).then((cache) => cache.put("/mic", copy));
          return live;
        })
        .catch(() => caches.match("/mic").then((kept) => kept ?? Response.error()))
    );
    return;
  }

  // Build files are named by their hash and never change: kept copy first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then(
        (kept) =>
          kept ??
          fetch(event.request).then((live) => {
            const copy = live.clone();
            void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return live;
          })
      )
    );
  }
});
