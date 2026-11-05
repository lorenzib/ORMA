'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { collectAppFiles, ENTRY_PAGES, HIKING_ORIGIN_LINE, SITE_ORIGIN, REMOTE_REF, MANIFEST_TAG, APP_MANIFEST_TAG } = require('./scripts/build-app');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/regions-manifest.json'), 'utf8'));
const clean = file => file.split(/[?#]/)[0];

// The app build used to name its region files by hand. It named the two
// regions that existed in August, so seven later regions and every trail's
// detail file were left out, and a trail page in the app opened empty. These
// checks read the same manifest the loader reads, so they grow with it.
describe('the app ships every trail a page can ask for', () => {
  const { files, missing } = collectAppFiles();

  test('nothing the app refers to is missing from the repository', () => {
    expect(missing).toEqual([]);
  });

  test('every region\'s trail list, water, huts and dog routes ship', () => {
    const absent = [];
    for (const [region, entry] of Object.entries(manifest.regions)) {
      for (const key of ['trails', 'water', 'hutsBars', 'dogRoutes']) {
        if (entry[key] && !files.has(clean(entry[key]))) absent.push(`${region}.${key}`);
      }
    }
    expect(absent).toEqual([]);
  });

  test('every trail\'s detail file ships, because a trail page loads it first', () => {
    const details = Object.values(manifest.regions).flatMap(entry => Object.values(entry.details || {}));
    expect(details.length).toBeGreaterThan(0);
    expect(details.map(clean).filter(file => !files.has(file))).toEqual([]);
  });

  test('every image a trail record names ships, except trail photos, which load from the website', () => {
    const named = new Set();
    for (const entry of Object.values(manifest.regions)) {
      const source = fs.readFileSync(path.join(root, clean(entry.trails)), 'utf8');
      for (const match of source.matchAll(/"(images\/[^"?#]+)"/g)) named.add(match[1]);
    }
    const local = [...named].filter(file => !file.startsWith('images/trails/'));
    expect(named.size).toBeGreaterThan(local.length);
    expect(local.filter(file => !files.has(file))).toEqual([]);
    expect([...files].filter(file => file.startsWith('images/trails/'))).toEqual([]);
  });

  test('a smaller copy of every shipped photo ships too, because scripts swap it in by name', () => {
    const shipped = new Set([...files].filter(file => file.startsWith('images/')).map(file => file.replace(/\.[a-z0-9]+$/i, '')));
    const variants = fs.readdirSync(path.join(root, 'images'))
      .map(name => `images/${name}`)
      .filter(file => /-\d+\.[a-z0-9]+$/i.test(file) && shipped.has(file.replace(/-\d+\.[a-z0-9]+$/i, '')));
    expect(variants).toContain('images/lago-di-braies-480.webp');
    expect(variants.filter(file => !files.has(file))).toEqual([]);
  });

  test('no operator surface ships inside the app', () => {
    expect([...files].filter(file => /^backoffice|-desk\.html$|^scripts\/|\.test\.js$/.test(file))).toEqual([]);
  });
});

// The trail route lines are tiles built during the website deploy, so they are
// never in the repository and the app loads them from the website. The build
// finds the line to rewrite by its exact text, so it must still be there.
describe('the app draws trail route lines from the website', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');

  test('map-style.js still has the one line the app build rewrites', () => {
    expect(read('map-style.js').split(HIKING_ORIGIN_LINE)).toHaveLength(2);
    expect(read('trail-app.bundle.js')).toContain(HIKING_ORIGIN_LINE);
  });

  test('the site itself keeps serving its own tiles', () => {
    expect(SITE_ORIGIN).toBe('https://www.app-orma.com');
    expect(read('map-style.js')).toContain('return HIKING_ORIGIN || (global.location && global.location.origin);');
  });
});

// Trail photos are most of the bundle, so the app asks the website for them.
describe('the app loads trail photos from the website', () => {
  const rewrite = text => text.replace(REMOTE_REF, `$1${SITE_ORIGIN}/$2`);

  test('every way a page or record names a trail photo points at the site', () => {
    const photo = `${SITE_ORIGIN}/images/trails/x.jpg`;
    expect(rewrite('{"image":"images/trails/x.jpg"}')).toBe(`{"image":"${photo}"}`);
    expect(rewrite('<img src="../images/trails/x.jpg">')).toBe(`<img src="${photo}">`);
    expect(rewrite("url('./images/trails/x.jpg')")).toBe(`url('${photo}')`);
    expect(rewrite('url(/images/trails/x.jpg)')).toBe(`url(${photo})`);
  });

  test('an address that already names the site is left alone', () => {
    const tag = '<meta property="og:image" content="https://www.app-orma.com/images/trails/x.jpg">';
    expect(rewrite(tag)).toBe(tag);
  });

  test('the photo check still accepts a photo once it carries the site address', () => {
    const { licensedPhotos, editorialPhotos } = require('./trail-photo-provenance');
    const licensed = { image: 'images/trails/x.jpg', creator: 'A', licence: 'CC BY-SA 4.0', sourcePage: 'https://commons.wikimedia.org/x' };
    const editorial = { image: 'images/trails/y.jpg', source: 'orma-editorial' };
    const inApp = photo => ({ ...photo, image: rewrite(JSON.stringify(photo.image)).slice(1, -1) });
    expect(licensedPhotos({ licensedPhotos: [inApp(licensed)] })).toHaveLength(1);
    expect(editorialPhotos({ editorialPhotos: [inApp(editorial)] })).toHaveLength(1);
    // Only the site itself, not any address that ends in images/trails/.
    expect(licensedPhotos({ licensedPhotos: [{ ...licensed, image: 'https://example.com/images/trails/x.jpg' }] })).toHaveLength(0);
  });
});

// A trail published after a release reaches the app the same day: online, app
// pages read the trail list and its files from the website; offline, the copy
// inside the app. This runs app-trail-data.js the way a page would.
describe('the app reads new trails from the website when online', () => {
  const source = fs.readFileSync(path.join(root, 'app-trail-data.js'), 'utf8');
  const site = `${SITE_ORIGIN}/`;

  function page({ online = true } = {}) {
    const written = [];
    const window = { navigator: { onLine: online } };
    window.document = { write: html => written.push(html) };
    window.window = window;
    vm.createContext(window);
    vm.runInContext(source, window);
    return { window, written };
  }
  const websiteManifest = () => ({
    schemaVersion: 1,
    regions: { dolomites: { trailCount: 1, trails: 'data/regions/dolomites-trails.js?v=1',
      water: 'data/regions/dolomites-water.geojson', details: { cadini: 'data/trail-details/cadini.js?v=2' } } },
    trailRegion: { cadini: 'dolomites' },
  });

  test('every app page that loads the trail list loads it through app-trail-data.js', () => {
    const pages = ENTRY_PAGES.filter(file => fs.readFileSync(path.join(root, file), 'utf8').includes('regions-runtime-manifest.js'));
    expect(pages.length).toBeGreaterThan(5);
    for (const file of pages) {
      const app = fs.readFileSync(path.join(root, file), 'utf8').replace(MANIFEST_TAG, APP_MANIFEST_TAG);
      expect([file, app.includes('regions-runtime-manifest.js')]).toEqual([file, false]);
      const loader = app.indexOf('regional-trails-loader.js');
      expect([file, loader === -1 || app.indexOf(APP_MANIFEST_TAG) < loader]).toEqual([file, true]);
    }
    expect(collectAppFiles().files.has('app-trail-data.js')).toBe(true);
  });

  test('the app understands the trail data the website publishes today', () => {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'regions-runtime-manifest.js'), 'utf8'), context);
    expect(page().window.DoloPawsAppTrailData.SCHEMA).toBe(context.window.DoloPawsRegionManifest.schemaVersion);
    expect(page().window.DoloPawsAppTrailData.SITE).toBe(site);
  });

  test('online, it asks the website first and then checks what arrived', () => {
    const { written } = page();
    expect(written).toEqual([
      `<script src="${site}regions-runtime-manifest.js"></script>`,
      '<script>window.DoloPawsAppTrailData.settle();</script>',
    ]);
  });

  test('offline, it uses the copy inside the app and never waits on the network', () => {
    expect(page({ online: false }).written).toEqual(['<script src="regions-runtime-manifest.js"></script>']);
  });

  test('when the website answers, every file the list names comes from the website too', () => {
    const { window, written } = page();
    window.DoloPawsRegionManifest = websiteManifest();
    window.DoloPawsAppTrailData.settle();
    expect(written).toHaveLength(2);
    expect(window.DoloPawsRegionManifest.regions.dolomites).toEqual({
      trailCount: 1,
      trails: `${site}data/regions/dolomites-trails.js?v=1`,
      water: `${site}data/regions/dolomites-water.geojson`,
      details: { cadini: `${site}data/trail-details/cadini.js?v=2` },
    });
    expect(window.DoloPawsRegionManifest.base).toBe(site);
  });

  test('a trail from the website shows its pictures from the website', () => {
    const { window } = page();
    window.DoloPawsRegionManifest = websiteManifest();
    window.DoloPawsAppTrailData.settle();
    const trail = {
      id: 'new', path: [[46.1, 11.1]], heroImage: 'images/trails/new.jpg', icon: './images/marker.svg',
      licensedPhotos: [{ image: 'images/trails/new-2.jpg', sourcePage: 'https://commons.wikimedia.org/x' }],
      gallery: ['images/trails/new-3.jpg'], name: 'images of the lake',
    };
    window.trails = [].concat([trail]);
    expect(window.trails[0]).toEqual({
      ...trail, heroImage: `${site}images/trails/new.jpg`, icon: `${site}images/marker.svg`,
      licensedPhotos: [{ image: `${site}images/trails/new-2.jpg`, sourcePage: 'https://commons.wikimedia.org/x' }],
      gallery: [`${site}images/trails/new-3.jpg`],
    });
    // Assigning the list again, as each region file does, leaves it as it is.
    window.trails = window.trails.concat([]);
    expect(window.trails[0].heroImage).toBe(`${site}images/trails/new.jpg`);
  });

  test('a list in a shape this app does not know is ignored, and the copy inside is used', () => {
    const { window, written } = page();
    window.DoloPawsRegionManifest = { ...websiteManifest(), schemaVersion: 2 };
    window.DoloPawsAppTrailData.settle();
    expect(window.DoloPawsRegionManifest).toBeUndefined();
    expect(written[2]).toBe('<script src="regions-runtime-manifest.js"></script>');
  });

  test('when the website cannot be reached, the copy inside is used', () => {
    const { window, written } = page();
    window.DoloPawsAppTrailData.settle();
    expect(written[2]).toBe('<script src="regions-runtime-manifest.js"></script>');
  });
});
