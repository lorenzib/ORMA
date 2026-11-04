'use strict';

const fs = require('fs');
const path = require('path');
const { collectAppFiles, HIKING_ORIGIN_LINE, SITE_ORIGIN, REMOTE_REF } = require('./scripts/build-app');

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
