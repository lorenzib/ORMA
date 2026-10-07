'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/regions-manifest.json'), 'utf8'));

/**
 * Run the loader the way a page does, and report what it wrote into the
 * document synchronously versus what it deferred.
 */
function runLoader({ search, defaultRegion, readyState = 'loading' }) {
  const written = [];
  const listeners = {};
  const appended = [];
  const sandbox = {
    window: {
      DoloPawsRegionManifest: manifest,
      location: { search },
      dispatchEvent() {},
      addEventListener(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    },
    document: {
      currentScript: { dataset: { defaultRegion } },
      readyState,
      createElement: () => { const el = {}; appended.push(el); return el; },
      head: { appendChild() {} },
      write(chunk) { written.push(chunk); },
    },
    sessionStorage: { setItem() {} },
    URLSearchParams, Set, Promise, CustomEvent: function () {}, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'regional-trails-loader.js'), 'utf8'), sandbox,
    { filename: 'regional-trails-loader.js' });
  const sources = written.join('').match(/src="([^"]+)"/g) || [];
  return {
    sync: sources.map(entry => entry.replace(/^src="|"$/g, '').split('?')[0]),
    deferredRegion: Boolean(listeners.load && listeners.load.length),
    api: sandbox.window.DoloPawsRegionalData,
    fireLoad() { (listeners.load || []).forEach(fn => fn()); },
    appended,
  };
}

describe('a trail page paints from its own detail file', () => {
  // The defect: `mode` was overwritten with the region name, so the later
  // `mode === 'trail'` tests were never true and a trail view document.write'd
  // the whole regional catalogue -- 760 KB, 151 KB gzipped, in front of the
  // paint -- instead of the one ~12 KB detail file it needs.
  test('it writes one detail file, not the regional catalogue', () => {
    const run = runLoader({ search: '?id=osm-19974725', defaultRegion: 'trail' });
    expect(run.sync).toEqual(['data/trail-details/osm-19974725.js']);
    expect(run.sync.join()).not.toContain('data/regions/');
  });

  test('a slug URL resolves to the same single detail file', () => {
    const slug = manifest.trailSlug['osm-19974725'];
    const run = runLoader({ search: `?id=${slug}`, defaultRegion: 'trail' });
    expect(run.sync).toEqual(['data/trail-details/osm-19974725.js']);
  });

  // Neighbours still need the rest of the region, so it is fetched -- after the
  // document, not in front of it.
  test('the rest of the region is deferred, not dropped', () => {
    const run = runLoader({ search: '?id=osm-19974725', defaultRegion: 'trail' });
    expect(run.deferredRegion).toBe(true);
    expect(run.appended).toHaveLength(0);
    run.fireLoad();
    expect(run.appended).toHaveLength(1);
  });

  test('a page that asks for whole regions still gets them up front', () => {
    const all = runLoader({ search: '', defaultRegion: 'all' });
    expect(all.sync).toEqual(expect.arrayContaining([
      'data/regions/dolomites-trails.js', 'data/regions/savoy-trails.js',
    ]));
    expect(all.deferredRegion).toBe(false);

    const one = runLoader({ search: '', defaultRegion: 'dolomites' });
    expect(one.sync).toEqual(['data/regions/dolomites-trails.js']);
    expect(one.deferredRegion).toBe(false);
  });
});

describe('what has to re-run when the region lands late', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');

  test('the audit overlay is idempotent and exported, because it must be re-applied', () => {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(read('trail-audits.js'), sandbox, { filename: 'trail-audits.js' });
    const api = sandbox.window.DoloPawsTrailAudits;
    expect(api && typeof api.apply).toBe('function');

    // The generator for the regional data does not read trail-audits.js, so a
    // trail arriving with the region carries its un-audited figures until this
    // runs. Values come from the file itself, not from a hand-typed copy.
    const audited = /'osm-14381570':\s*\{[\s\S]*?distance:\s*([\d.]+)/.exec(read('trail-audits.js'));
    expect(audited).not.toBeNull();
    const list = [{ id: 'osm-14381570', distance: 999 }];
    api.apply(list);
    expect(list[0].distance).toBe(Number(audited[1]));
    api.apply(list);
    expect(list[0].distance).toBe(Number(audited[1]));
  });

  test('the loader re-applies the annotation chain when a region arrives', () => {
    const loader = read('regional-trails-loader.js');
    const onload = loader.slice(loader.indexOf('script.onload'), loader.indexOf('script.onerror'));
    expect(onload).toContain('DoloPawsRegions');
    expect(onload).toContain('DoloPawsTrailAudits');
    expect(onload).toContain('dolopaws-region-loaded');
  });

  test('the nearby grid and the map layers both listen for it', () => {
    expect(read('trail-blueprint.js')).toContain("window.addEventListener('dolopaws-region-loaded', nearby)");
    const trail = read('trail.js');
    expect(trail).toContain("window.addEventListener('dolopaws-region-loaded', renderNearbyTrailLayers)");
    // Adding to a style that has not loaded throws, and the region can land at
    // any moment.
    expect(trail).toContain('map.isStyleLoaded');
    // Added once, however many times the region announces itself.
    expect(trail).toContain('if(nearbyLayersAdded) return;');
  });
});

describe('every trail-page script resolves the URL param', () => {
  // Regression shipped in #648: trail-blueprint read params.get('id') raw, so a
  // slug URL missed the lookup and the whole blueprint returned early, taking
  // the nearby grid, the access card and the dog-fit panel with it.
  const CONSUMERS = [
    'trail-blueprint.js', 'trail-recommendation.js', 'offline-packages.js',
    'guest-context.js', 'trail.js',
  ];

  test('a script that looks a trail up by the id param resolves it first', () => {
    const offenders = [];
    for (const file of CONSUMERS) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      if (!/get\('id'\)/.test(source)) continue;
      if (!source.includes('resolveTrailId')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
