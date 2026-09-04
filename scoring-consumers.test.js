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
