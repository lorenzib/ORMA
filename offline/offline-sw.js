'use strict';

const CACHE_PREFIX = 'dolopaws-trail-';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function matchPackage(request, options){
  const names = await caches.keys();
  for(const name of names){
    if(!name.startsWith(CACHE_PREFIX) || name.endsWith('-installing')) continue;
    const response = await (await caches.open(name)).match(request, options);
    if(response) return response;
  }
  return null;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  if(event.request.mode === 'navigate'){
    event.respondWith((async () => {
      const cached = await matchPackage(new URL('trail.html', self.registration.scope).href);
      if(cached) return cached;
      try{
        return await fetch(event.request);
      }catch(error){
        return new Response('This ORMA trail has not been downloaded on this device.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await matchPackage(event.request);
    if(cached) return cached;
    return fetch(event.request);
  })());
});
