const fs = require('fs');
const path = require('path');
const vm = require('vm');
const canonical = require('./scoring/recommendation-v1.js');

const root = __dirname;

function read(file){
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function browserScoring(){
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    'trust/evidence-v1.js',
    'scoring/recommendation-v1.js',
    'scoring/recommendation-adapters-v1.js',
    'scoring.js',
  ].forEach(file => vm.runInContext(read(file), context));
  return context;
}

describe('SCORE-03 behaviour normalization at the legacy boundary', () => {
  const adapters = require('./scoring/recommendation-adapters-v1.js');

  test('only recognised scale answers reach the scorer', () => {
    const normalized = adapters.normalizeDog({
      fitness:'moderate',
      behaviour:{
        recall:'variable',
        // A stale or hand-edited client must not be able to write a value the
        // scorer would misread as the easy end of a scale.
        preyDrive:'extreme',
        livestockComfort:'',
        heatTolerance:null,
        preferredDurationMin:'90',
      },
    });

    expect(normalized.behaviour).toEqual({ recall:'variable', preferredDurationMin:90 });
  });

  test('an out-of-range preferred duration is dropped rather than clamped', () => {
    expect(adapters.behaviour({ behaviour:{ preferredDurationMin:0 } })).toEqual({});
    expect(adapters.behaviour({ behaviour:{ preferredDurationMin:5000 } })).toEqual({});
    expect(adapters.behaviour({})).toEqual({});
  });

  test('legacy presentation trails declare behaviour attributes unknown, not benign', () => {
    const normalized = adapters.normalizeTrail({
      id:'legacy', distance:6, elevation:200, terrainRank:1, path:[[46, 12], [46.1, 12.1]],
    });

    expect(normalized.suitability).toEqual(expect.objectContaining({
      livestockPresence:'unknown', wildlifePresence:'unknown',
      sightlines:'unknown', roadProximity:'unknown', crowding:'unknown',
    }));
    expect(normalized.segments).toEqual([]);
  });
});

describe('SCORE-02 scoring consumers', () => {
  test('browser compatibility functions delegate to one versioned result', () => {
    const context = browserScoring();
    const trail = {
      id: 'representative',
      curated: false,
      distance: 6,
      elevation: 300,
      terrainRank: 1,
      shadeCoverage: 70,
      heatRisk: 'low',
      exposure: false,
      surfaceHazards: [],
      waterSources: [],
      verified: { categories: ['route', 'heat', 'exposure', 'surfaceHazards'] },
    };
    const profile = {
      ageBand: '3-4',
      weightBand: '15-20',
      fitness: 'moderate',
      conditions: [],
    };
    context.trailFixture = trail;
    context.profileFixture = profile;
    const first = vm.runInContext('recommendTrail(trailFixture, effectiveOverrides(profileFixture, null))', context);
    const second = vm.runInContext('recommendTrail(trailFixture, effectiveOverrides(profileFixture, null))', context);
    const numberOnly = vm.runInContext('scoreTrail(trailFixture, effectiveOverrides(profileFixture, null))', context);
    expect(JSON.parse(JSON.stringify(second))).toEqual(JSON.parse(JSON.stringify(first)));
    expect(numberOnly).toBe(first.score);
    expect(first.scoringVersion).toBe(canonical.VERSION);
    expect(context.DoloPawsScoring.VERSION).toBe(canonical.VERSION);
  });

  test.each(['index.html', 'trail.html', 'saved.html', 'safety-guide.html'])(
    '%s loads canonical dependencies before the compatibility facade',
    file => {
      if(file === 'trail.html'){
        const { expectBundledBefore, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');
        expectTrailBundleLoaded();
        expectBundledBefore('trust/evidence-v1.js', 'scoring/recommendation-v1.js');
        expectBundledBefore('scoring/recommendation-v1.js', 'scoring/recommendation-adapters-v1.js');
        expectBundledBefore('scoring/recommendation-adapters-v1.js', 'scoring.js');
        return;
      }
      const html = read(file);
      const evidence = html.indexOf('trust/evidence-v1.js');
      const engine = html.indexOf('scoring/recommendation-v1.js');
      const adapter = html.indexOf('scoring/recommendation-adapters-v1.js');
      const facade = html.indexOf('src="scoring.js');
      expect(evidence).toBeGreaterThan(-1);
      expect(evidence).toBeLessThan(engine);
      expect(engine).toBeLessThan(adapter);
      expect(adapter).toBeLessThan(facade);
    }
  );

  test('the retired saved-trail duplicate is gone', () => {
    expect(fs.existsSync(path.join(root, 'my-trails.js'))).toBe(false);
    expect(read('scoring.js')).not.toMatch(/score\s*-=/);
    expect(read('scoring.js')).toContain('recommendTrail(trail, subject, currentConditions).score');
  });

  test('generated and downloaded experiences publish the same version', () => {
    const generated = read('trails/lago-di-carezza-loop.html');
    const manifest = JSON.parse(read('offline/packages/lago-carezza/manifest.json'));
    expect(generated).toContain(`data-scoring-version="${canonical.VERSION}"`);
    expect(manifest.scoringVersion).toBe(canonical.VERSION);
  });
});
