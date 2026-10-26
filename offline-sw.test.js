const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Found testing as a signed-in user: a phone already holding Tre Cime from
// before a shared-file change downloaded Fenn Promenade, and the offline
// helper served Tre Cime's older offline page to Fenn, whose manifest then
// rejected it ("Offline trail page has changed size"). Each trail must be
// answered from its own package.
function worker(cacheContents, clientUrls = {}){
  const listeners = {};
  const caches = {
    keys: async () => Object.keys(cacheContents),
    open: async name => ({
      match: async request => {
        const url = typeof request === 'string' ? request : request.url;
        const body = cacheContents[name][new URL(url).pathname];
        return body === undefined ? undefined : { body, cache:name };
      },
    }),
  };
  const self = {
    location: new URL('https://www.app-orma.com/offline/offline-sw.js'),
    registration: { scope:'https://www.app-orma.com/offline/' },
    clients: { claim: async () => {}, get: async id => clientUrls[id] ? { url:clientUrls[id] } : undefined },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    skipWaiting: () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'offline', 'offline-sw.js'), 'utf8'), {
    self, caches, URL, Response:class { constructor(body){ this.body = body; } },
    fetch: async request => ({ body:'network', url:typeof request === 'string' ? request : request.url }),
  });
  return async (url, { mode = 'cors', clientId } = {}) => {
    let answer;
    listeners.fetch({ request:{ url, mode }, clientId, respondWith: promise => { answer = promise; } });
    return answer;
  };
}

const caches = {
  'dolopaws-trail-tre-cime-2026.10.23-beta.1': {
    '/offline/trail.html':'old page', '/offline/offline-app.js':'old app',
    '/offline/packages/tre-cime/manifest.json':'tre cime manifest',
  },
  'dolopaws-trail-osm-11839597-2026.10.24-beta.3': {
    '/offline/trail.html':'new page', '/offline/offline-app.js':'new app',
    '/offline/packages/osm-11839597/manifest.json':'fenn manifest',
  },
};

describe('the offline helper answers each trail from its own package', () => {
  test('opening Fenn Promenade gets Fenn\'s page, not the first package\'s', async () => {
    const fetch = worker(caches);
    const page = await fetch('https://www.app-orma.com/offline/trail.html?id=osm-11839597', { mode:'navigate' });
    expect(page.body).toBe('new page');
  });

  test('the page\'s own files come from the trail the page is showing', async () => {
    const fetch = worker(caches, {
      fenn:'https://www.app-orma.com/offline/trail.html?id=osm-11839597',
      tre:'https://www.app-orma.com/offline/trail.html?id=tre-cime',
    });
    expect((await fetch('https://www.app-orma.com/offline/offline-app.js', { clientId:'fenn' })).body).toBe('new app');
    expect((await fetch('https://www.app-orma.com/offline/offline-app.js', { clientId:'tre' })).body).toBe('old app');
    expect((await fetch('https://www.app-orma.com/offline/trail.html', { clientId:'fenn' })).body).toBe('new page');
  });

  test('Tre Cime still opens with the files its own manifest was built against', async () => {
    const fetch = worker(caches);
    const page = await fetch('https://www.app-orma.com/offline/trail.html?id=tre-cime', { mode:'navigate' });
    expect(page.body).toBe('old page');
  });

  test('a trail id never claims another trail whose id starts the same way', async () => {
    const fetch = worker({
      'dolopaws-trail-lago-carezza-north-2026.10.24-beta.1': { '/offline/trail.html':'north page' },
      'dolopaws-trail-lago-carezza-2026.10.24-beta.23': { '/offline/trail.html':'carezza page' },
    });
    const page = await fetch('https://www.app-orma.com/offline/trail.html?id=lago-carezza', { mode:'navigate' });
    expect(page.body).toBe('carezza page');
  });

  test('a file no package holds still comes from the network', async () => {
    const fetch = worker(caches);
    expect((await fetch('https://www.app-orma.com/offline/unknown.js')).body).toBe('network');
  });
});
