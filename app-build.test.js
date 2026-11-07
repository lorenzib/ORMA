'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  collectAppFiles, ENTRY_PAGES, HIKING_ORIGIN_LINE, SITE_ORIGIN, REMOTE_REF, MANIFEST_TAG, APP_MANIFEST_TAG,
  VIEWPORT_TAG, APP_VIEWPORT_TAG, APP_SHELL_TAG, APP_TABBAR_TAG, APP_FLAG_TAG,
} = require('./scripts/build-app');

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

  test('a picture a script names by path ships, even with a version suffix', () => {
    // homepage-search.js names its "how it works" pictures as
    // 'images/orma-how-assess.jpg?v=...', which the markup scan never sees.
    const named = [...fs.readFileSync(path.join(root, 'homepage-search.js'), 'utf8')
      .matchAll(/'(images\/orma-how-[^'?]+)\?v=/g)].map(match => match[1]);
    expect(named).toContain('images/orma-how-assess-1920.jpg');
    expect(named.filter(file => !files.has(file))).toEqual([]);
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

// The app draws edge to edge, so without app-shell.css the header sits under
// the clock and the footer tells someone already in the app to install it.
describe('app pages make room for the clock and drop the install advice', () => {
  const { files } = collectAppFiles();
  const pages = [...files].filter(file => file.endsWith('.html'));
  const shell = fs.readFileSync(path.join(root, 'app-shell.css'), 'utf8');

  test('every app page opts into the full screen, never zooms on a tap, and loads app-shell.css', () => {
    expect(files.has('app-shell.css')).toBe(true);
    const unfit = pages.filter((file) => {
      const app = fs.readFileSync(path.join(root, file), 'utf8')
        .replace(VIEWPORT_TAG, APP_VIEWPORT_TAG).replace('</head>', `${APP_SHELL_TAG}\n</head>`);
      return !/<meta name="viewport" content="[^"]*maximum-scale=1, viewport-fit=cover">/.test(app) || !app.includes(APP_SHELL_TAG);
    });
    expect(unfit).toEqual([]);
  });

  test('the rules still name the header and the footer block the pages use', () => {
    const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(shell).toMatch(/\.topnav\{[^}]*safe-area-inset-top/);
    expect(styles).toMatch(/\.topnav\{/);
    expect(shell).toMatch(/\.hp-footer-get\{display:none;\}/);
    expect(index).toContain('class="hp-footer-get"');
  });

  test('the website never loads the app rules', () => {
    const linked = pages.filter(file => fs.readFileSync(path.join(root, file), 'utf8').includes('app-shell.css'));
    expect(linked).toEqual([]);
  });
});

// A native app is moved around by its tabs. app-tabbar.js draws them on every
// app page, so each tab has to lead to a page the app ships, and the website,
// which has its own header menu, never loads it.
describe('the app has a bottom tab bar', () => {
  const { files } = collectAppFiles();
  const pages = [...files].filter(file => file.endsWith('.html'));
  const tabbar = fs.readFileSync(path.join(root, 'app-tabbar.js'), 'utf8');
  const build = fs.readFileSync(path.join(root, 'scripts', 'build-app.js'), 'utf8');

  test('ships the script and links it into every page with the app rules', () => {
    expect(files.has('app-tabbar.js')).toBe(true);
    expect(build).toContain('${APP_SHELL_TAG}\\n${APP_TABBAR_TAG}');
    expect(APP_TABBAR_TAG).toBe('<script src="/app-tabbar.js" defer></script>');
  });

  test('every tab opens a page inside the app', () => {
    const targets = [...tabbar.matchAll(/href:'\/([^']+)'/g)].map(match => match[1]);
    expect(targets).toEqual(['index.html', 'saved.html', 'walk.html', 'account.html']);
    expect(targets.filter(target => !files.has(target))).toEqual([]);
  });

  test('the website never loads it', () => {
    const linked = pages.filter(file => fs.readFileSync(path.join(root, file), 'utf8').includes('app-tabbar.js'));
    expect(linked).toEqual([]);
    expect(fs.readFileSync(path.join(root, '_config.yml'), 'utf8')).toMatch(/^  - app-tabbar\.js$/m);
  });
});

// An app is used, not read about: it opens on the map and the ranked list for
// everyone, so the website's guest landing page never shows inside it.
describe('the app opens on the map for every visitor', () => {
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const shell = fs.readFileSync(path.join(root, 'app-shell.css'), 'utf8');
  const build = fs.readFileSync(path.join(root, 'scripts', 'build-app.js'), 'utf8');

  test('app pages are marked before anything draws', () => {
    expect(APP_FLAG_TAG).toBe("<script>document.documentElement.classList.add('orma-app');</script>");
    expect(build).toContain('${APP_FLAG_TAG}\\n${APP_SHELL_TAG}');
  });

  test('the homepage takes the map view when it is marked', () => {
    expect(script).toMatch(/const inApp = document\.documentElement\.classList\.contains\('orma-app'\);\s*if\(forced === 'returning' \|\| inApp\)/);
  });

  test('the guest landing page is hidden from the first paint, and the website is untouched', () => {
    expect(shell).toContain('html.orma-app #newCustomerHomepage{display:none !important;}');
    expect(shell).toContain('html.orma-app #returningCustomerHomepage[hidden]{display:flex !important;}');
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(index).not.toContain('orma-app');
    expect(index).toContain('id="liNewWrap"');
    expect(index).toContain('class="li-list-foot"');
  });
});

// The app's Explore list gives the recommendation, not the argument for it:
// no reasons and no "based on available trail data · checked on" line, while
// See on map and Get directions stay. The website keeps all of it.
describe('the app list cards are compact', () => {
  const shell = fs.readFileSync(path.join(root, 'app-shell.css'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  test('the reasons and the data-checked line are hidden in the app only', () => {
    expect(shell).toMatch(/html\.orma-app #liReasonsToggle,\s*html\.orma-app \.li-row \.li-why-toggle,\s*html\.orma-app \.li-row \.li-answer-explanation\{display:none !important;\}/);
    expect(shell).toContain('html.orma-app .li-row-trust > span');
    expect(index).toContain('id="liReasonsToggle"');
    expect(script).toContain('class="li-answer-explanation"');
    expect(script).toContain('<div class="li-row-trust"><strong>');
  });

  test('See on map and Get directions are never hidden', () => {
    expect(shell).not.toMatch(/(locate-btn|li-dir-toggle|li-row-bar)[^{]*\{[^}]*display:none/);
    expect(script).toContain("tx('See on map')");
    expect(script).toContain("tx('Get directions')");
  });
});
