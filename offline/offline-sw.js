'use strict';

const CACHE_PREFIX = 'dolopaws-trail-';
const TRAIL_ID = /^[a-z0-9-]+$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// The trail a request belongs to: the offline page carries it as ?id=, a
// package file names it in its path, and anything else the page loads (its
// script, styles, the GPS and routing helpers) belongs to the page's trail.
function trailIdFrom(url){
  try{
    const parsed = new URL(url);
    const id = parsed.searchParams.get('id');
    if(id && TRAIL_ID.test(id)) return id;
    const match = parsed.pathname.match(/\/offline\/packages\/([a-z0-9-]+)\//);
    return match ? match[1] : null;
  }catch(error){
    return null;
  }
}

async function trailIdFor(event){
  const own = trailIdFrom(event.request.url);
  if(own) return own;
  if(!event.clientId) return null;
  const client = await self.clients.get(event.clientId);
  return client ? trailIdFrom(client.url) : null;
}

// A trail's cache is `dolopaws-trail-<id>-<version>`, and versions start with
// a date, so lago-carezza never claims a lago-carezza-north package.
function belongsTo(name, trailId){
  return name.startsWith(`${CACHE_PREFIX}${trailId}-`) &&
    /^\d{4}\./.test(name.slice(`${CACHE_PREFIX}${trailId}-`.length));
}

// Every package stores the shared offline files at the same URLs, and two
// packages of different revisions hold different bytes for them. Taking the
// first cache that had the URL served Tre Cime's older offline page to Fenn
// Promenade, whose manifest then rejected it ("Offline trail page has changed
// size"). The trail's own package answers first; another package only for a
// file the trail's own does not hold.
async function matchPackage(request, trailId, options){
  const names = (await caches.keys())
    .filter(name => name.startsWith(CACHE_PREFIX) && !name.endsWith('-installing'));
  const own = trailId ? names.filter(name => belongsTo(name, trailId)) : [];
  for(const name of [...own, ...names.filter(name => !own.includes(name))]){
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
      const cached = await matchPackage(
        new URL('trail.html', self.registration.scope).href,
        trailIdFrom(event.request.url)
      );
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
    const cached = await matchPackage(event.request, await trailIdFor(event));
    if(cached) return cached;
    return fetch(event.request);
  })());
});
