'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { assignSlugs } = require('./scripts/trail-adapter');
const { loadSlugOverrides } = require('./scripts/trail-slug-overrides');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/regions-manifest.json'), 'utf8'));

// Values come from the producers -- loadProductionTrails and assignSlugs -- not
// from hand-typed copies, so these cannot pass against a slug nothing emits.
const trails = loadProductionTrails(root);
// With the overrides, because that is what the manifest builder uses: a
// derived slug ties the URL to the name, and a pinned one is how a name was
// fixed without moving the page.
const slugOverrides = loadSlugOverrides(root);
const slugs = assignSlugs(trails, slugOverrides);

/** The loader's public API, run against the real manifest in a bare sandbox. */
function loadRegionalApi(search) {
  const written = [];
  const sandbox = {
    window: { DoloPawsRegionManifest: manifest, location: { search }, dispatchEvent() {}, addEventListener() {} },
    document: {
      currentScript: { dataset: { defaultRegion: 'trail' } },
      createElement: () => ({}), head: { appendChild() {} }, write(chunk) { written.push(chunk); },
    },
    sessionStorage: { setItem() {} },
    URLSearchParams, Set, Promise, CustomEvent: function () {}, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'regional-trails-loader.js'), 'utf8'), sandbox,
    { filename: 'regional-trails-loader.js' });
  return { api: sandbox.window.DoloPawsRegionalData, written: written.join('') };
}

describe('a trail URL reads as the trail, and the id stays the key', () => {
  test('every trail has a slug, and the slugs are unique', () => {
    const missing = trails.filter(trail => !manifest.trailSlug[trail.id]).map(trail => trail.id);
    expect(missing).toEqual([]);
    expect(Object.keys(manifest.trailSlug)).toHaveLength(trails.length);
    const seen = new Set(Object.values(manifest.trailSlug));
    expect(seen.size).toBe(trails.length);
  });

  test('the manifest slug is the one assignSlugs produces', () => {
    const disagreements = trails
      .map((trail, index) => ({ id: trail.id, manifest: manifest.trailSlug[trail.id], expected: slugs[index] }))
      .filter(row => row.manifest !== row.expected);
    expect(disagreements).toEqual([]);
  });

  test('slug and id resolve to the same trail, in both directions', () => {
    for (const trail of trails) {
      const slug = manifest.trailSlug[trail.id];
      expect(manifest.slugToId[slug]).toBe(trail.id);
    }
  });

  // The collision rule: two trails are both called "Panoramaweg", so one of
  // them carries its id as a suffix. Taken from the data, not asserted by name.
  test('a duplicated trail name still gets its own slug', () => {
    // Constructed rather than found. The catalogue had two trails both called
    // Panoramaweg and this test rested on that, so disambiguating them by
    // valley -- which is the fix a customer needed -- left it asserting that a
    // problem still existed. A collision is a property of the function, not of
    // whatever the catalogue happens to contain today.
    const pair = [{ id: 'osm-1', name: 'Panoramaweg' }, { id: 'osm-2', name: 'Panoramaweg' }];
    const slugged = assignSlugs(pair);
    expect(new Set(slugged).size).toBe(2);
    expect(slugged[0]).toBe('panoramaweg');
    expect(slugged[1]).toContain('osm-2');
  });

  test('and no two trails in the catalogue share a slug', () => {
    const slugged = trails.map(trail => manifest.trailSlug[trail.id]);
    expect(new Set(slugged).size).toBe(slugged.length);
  });

  // The whole point of keeping the id: trailWalks, hikeEvents, reviews and the
  // verification pipeline are all keyed by it, and so is every link already
  // shared. An osm id in a URL has to keep working forever.
  test('a link shared before slugs existed still resolves', () => {
    const { api } = loadRegionalApi('?id=osm-19974725');
    expect(api.resolveTrailId('osm-19974725')).toBe('osm-19974725');
    for (const trail of trails.slice(0, 40)) {
      expect(api.resolveTrailId(trail.id)).toBe(trail.id);
    }
  });

  test('a slug resolves to its id, and an unknown value is returned unchanged', () => {
    const { api } = loadRegionalApi('?id=osm-19974725');
    for (const trail of trails.slice(0, 40)) {
      expect(api.resolveTrailId(manifest.trailSlug[trail.id])).toBe(trail.id);
    }
    // Unchanged rather than null, so "trail not found" can name what was asked.
    expect(api.resolveTrailId('no-such-trail')).toBe('no-such-trail');
    expect(api.resolveTrailId('')).toBe('');
  });

  test('the region lookup accepts a slug as readily as an id', () => {
    const { api } = loadRegionalApi('?id=osm-19974725');
    for (const trail of trails.slice(0, 40)) {
      expect(api.regionForTrail(manifest.trailSlug[trail.id])).toBe(api.regionForTrail(trail.id));
    }
  });

  test('a link built for a trail reads as its title', () => {
    const { api } = loadRegionalApi('?id=osm-19974725');
    const sample = trails.find(trail => /^osm-/.test(trail.id));
    expect(api.slugFor(sample.id)).toBe(manifest.trailSlug[sample.id]);
    expect(api.slugFor({ id: sample.id })).toBe(manifest.trailSlug[sample.id]);
    expect(api.trailHref({ id: sample.id })).toBe(`trail.html?id=${manifest.trailSlug[sample.id]}`);
    expect(api.trailHref({ id: sample.id }, { from: 'collections.html' }))
      .toBe(`trail.html?id=${manifest.trailSlug[sample.id]}&from=collections.html`);
    // An unknown trail keeps a working link rather than an empty one.
    expect(api.slugFor('no-such-trail')).toBe('no-such-trail');
  });
});

describe('the static pages and the app agree on the slug', () => {
  const pageFiles = new Set(fs.readdirSync(path.join(root, 'trails')).filter(name => name.endsWith('.html')));

  // Two generators compute this independently: generate-trail-pages names the
  // file, build-regional-runtime-data writes the map the app resolves through.
  // If they ever disagree, a link on a crawlable page 404s in the app.
  test('every published page filename is the slug the manifest publishes', () => {
    const mismatched = [];
    for (const [id, slug] of Object.entries(manifest.trailSlug)) {
      if (!pageFiles.has(`${slug}.html`)) continue; // a draft has no page
      if (manifest.slugToId[slug] !== id) mismatched.push(`${slug}.html -> ${manifest.slugToId[slug]}, expected ${id}`);
    }
    expect(mismatched).toEqual([]);
    expect(pageFiles.size).toBeGreaterThan(100);
  });

  test('a generated page links onward by slug, never by raw id', () => {
    const offenders = [];
    for (const name of pageFiles) {
      const html = fs.readFileSync(path.join(root, 'trails', name), 'utf8');
      const ids = html.match(/trail\.html\?id=osm-\d+/g);
      if (ids) offenders.push(`${name}: ${[...new Set(ids)].join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  test('the browse index links by slug', () => {
    const html = fs.readFileSync(path.join(root, 'browse-trails.html'), 'utf8');
    expect(html.match(/trail\.html\?id=osm-\d+/g)).toBeNull();
  });

  // A visitor holding a cached manifest without the maps would lose every slug
  // link, so the manifest and the loader must be re-fetched together.
  test('the manifest and loader are pinned to the same new version', () => {
    for (const page of ['trail.html', 'browse-trails.html', 'collections.html', 'compare.html']) {
      const html = fs.readFileSync(path.join(root, page), 'utf8');
      expect(html).toContain('regions-runtime-manifest.js?v=20261007-1');
      expect(html).toContain('regional-trails-loader.js?v=20261007-2');
    }
  });

  // Each of these is served directly rather than through the bundle, so a
  // returning visitor keeps the cached copy unless its key moves. Missing one
  // is invisible in tests and shows up as a raw osm id in a live URL -- which
  // is exactly what happened to discovery-state.js, the file every browse card
  // links through.
  test('every script taught to emit a slug had its cache key moved', () => {
    // regional-trails-loader moved again with the detail-first load order, so
    // the expected token is per script rather than one shared value.
    const SLUG_AWARE = {
      'discovery-state': '20261007-1', 'regional-trails-loader': '20261007-2',
      'browse-map': '20261007-1', 'compare-page': '20261007-1',
      'collections-page': '20261007-1', 'homepage-search': '20261007-1',
      'mobile-nav': '20261007-1', 'notifications-feed': '20261023-1',
    };
    const stale = [];
    for (const name of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(root, name), 'utf8');
      for (const [script, expected] of Object.entries(SLUG_AWARE)) {
        const pattern = new RegExp(`src="(?:[^"]*/)?${script}\\.js\\?v=([^"]+)"`, 'g');
        for (const match of html.matchAll(pattern)) {
          if (match[1] !== expected) stale.push(`${name}: ${script}.js?v=${match[1]} (want ${expected})`);
        }
      }
    }
    expect(stale).toEqual([]);
  });

  test('no hand-written app script still builds a trail link from a raw id', () => {
    // The pass-through pages are excluded on purpose: they echo back whatever
    // param they were handed, which already resolves either way.
    const PASSES_THROUGH = new Set([
      'trail-hazards.js', 'trail-report-page.js', 'photo-upload-page.js',
      'reviews-page.js', 'offline-packages.js', 'pre-hike-readiness.js',
      'trail-app.bundle.js',
    ]);
    // File-scoped, not line-scoped: discovery-state resolves the slug into a
    // variable one line before it builds the href, which a per-line check reads
    // as a raw id.
    const offenders = [];
    for (const name of fs.readdirSync(root).filter(file => file.endsWith('.js'))) {
      if (PASSES_THROUGH.has(name) || name.endsWith('.test.js')) continue;
      const source = fs.readFileSync(path.join(root, name), 'utf8');
      if (!source.includes('trail.html?id=')) continue;
      if (source.includes('slugFor')) continue;
      offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});

describe('a slug is a URL a reader reads as a title', () => {
  const { slugify } = require('./scripts/trail-adapter');

  // ss-ligature, ae, oe and o-slash carry no combining accent, so NFD leaves
  // them whole and the a-z filter turns them into a separator. "Grosse
  // Schlossrunde" (with the ligature) slugified to `gro-e-schlossrunde`, which
  // was about to ship as a new page's URL.
  test('a letter with no accent to strip is spelled out, not cut', () => {
    expect(slugify('Gro\u00dfe Schlossrunde')).toBe('grosse-schlossrunde');
    expect(slugify('Wei\u00dfsee')).toBe('weisssee');
    expect(slugify('\u00c6bleskiven')).toBe('aebleskiven');
    expect(slugify('C\u0153ur de Savoie')).toBe('coeur-de-savoie');
    expect(slugify('M\u00f8rkdalen')).toBe('morkdalen');
  });

  test('an accent that NFD can strip still is', () => {
    expect(slugify('Toblacher H\u00f6henweg')).toBe('toblacher-hohenweg');
    expect(slugify('Steine erz\u00e4hlen')).toBe('steine-erzahlen');
    expect(slugify('Tru di L\u00ebc')).toBe('tru-di-lec');
  });

  test('no trail in the catalogue slugifies to an empty segment', () => {
    const { loadProductionTrails } = require('./scripts/load-production-trails');
    for (const trail of loadProductionTrails(__dirname)) {
      expect(slugify(trail.name)).not.toMatch(/(^-)|(-$)|(--)/);
    }
  });
});
