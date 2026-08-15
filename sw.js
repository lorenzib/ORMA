// KILL-SWITCH service worker.
//
// The previous worker ("dolopaws-v2") used a cache-first strategy with a
// fixed cache name: it pinned index, browse, script.js, styles.css and more
// on first visit and then served those stale copies FOREVER, ignoring every
// deploy. No page registers a service worker anymore, but browsers that
// installed the old one keep running it until it is replaced.
//
// Browsers re-check this file on navigation, so shipping this version makes
// every affected browser: delete all ORMA caches, unregister the worker,
// and reload the open pages straight from the network. After that, normal
// HTTP caching (GitHub Pages, max-age=600) is the only cache layer.
//
// Do NOT reintroduce a cache-first worker without a cache name that changes
// on every deploy.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      // Reload every open tab so it refetches everything from the network.
      client.navigate(client.url);
    }
  })());
});

// No fetch handler: every request goes straight to the network.
