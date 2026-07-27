const SHELL_CACHE = 'dolopaws-offline-poc-shell-v1';
const PACKAGE_PREFIX = 'dolopaws-offline-poc-package-';
const SHELL_RESOURCES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_RESOURCES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('dolopaws-offline-poc-shell-') && key !== SHELL_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin || !url.pathname.includes('/experiments/offline-map-poc/')) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if(cached) return cached;
    try{
      const response = await fetch(event.request);
      if(response.ok && !url.pathname.includes('/packages/')){
        const shell = await caches.open(SHELL_CACHE);
        shell.put(event.request, response.clone());
      }
      return response;
    }catch(error){
      if(event.request.mode === 'navigate'){
        const shell = await caches.open(SHELL_CACHE);
        const fallback = await shell.match('./index.html');
        if(fallback) return fallback;
      }
      throw error;
    }
  })());
});

self.addEventListener('message', event => {
  if(event.data !== 'CLEAR_POC_PACKAGES') return;
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(PACKAGE_PREFIX)).map(key => caches.delete(key))
    ))
  );
});
