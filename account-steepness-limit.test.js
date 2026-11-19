const fs = require('fs');
const path = require('path');
const engine = require('./scoring/recommendation-v1.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const adult = { ageYears:3.5, weightKg:25, conditions:[] };

describe('account page steepness limit follows the score', () => {
  test('the engine gives the same limit the score uses', () => {
    expect(engine.steepnessLimit({ ...adult, fitness:'moderate' })).toBe(2);
    expect(engine.steepnessLimit({ ...adult, fitness:'high' })).toBe(2);
    expect(engine.steepnessLimit({ ...adult, fitness:'low' })).toBe(0);
    expect(engine.steepnessLimit({ ...adult, fitness:'moderate', ageYears:9.5 })).toBe(1);
    expect(engine.steepnessLimit({ ...adult, fitness:'moderate', conditions:['joints'] })).toBe(1);
    expect(engine.steepnessLimit({ ...adult, fitness:'moderate', ageYears:9.5, conditions:['joints'] })).toBe(0);
  });

  test('the account page loads the engine and words the limit as steepness', () => {
    const html = read('account.html');
    const design = read('profile-design.js');
    expect(html).toContain('<script src="scoring/recommendation-v1.js" defer></script>');
    expect(html.indexOf('scoring/recommendation-v1.js')).toBeLessThan(html.indexOf('profile-design.js'));
    expect(html).toContain('>Steepness limit</span>');
    expect(design).toContain('engine.steepnessLimit(');
    for(const key of ['steepNone', 'steepModerate', 'steepGentle']) expect(design).toContain(`account.impact.${key}`);
    expect(design).not.toMatch(/rocky and below|gravel and below|mixed and below/);
  });
});

describe('"Recovering from injury" reaches the score', () => {
  test('the account page saves the code the score reads', () => {
    const design = read('profile-design.js');
    expect(design).toContain("'Recovering from injury':'recovering'");
    expect(design).not.toContain("'Recovering from injury':'injury'");
  });

  test('the old account-page code counts too, so saved profiles keep working', () => {
    const base = { ...adult, fitness:'moderate' };
    expect(engine.steepnessLimit({ ...base, conditions:['recovering'] })).toBe(1);
    expect(engine.steepnessLimit({ ...base, conditions:['injury'] })).toBe(1);
  });
});

describe('the homepage wizard\'s steepness answer counts', () => {
  const adapters = require('./scoring/recommendation-adapters-v1.js');
  const wizard = read('homepage-search.js');

  test('asks about steepness and saves the answer on the profile', () => {
    expect(wizard).toContain("t('hp.wizard.terrain', 'How steep can they go?')");
    expect(wizard).toContain("var STEEPNESS_LIMIT = { soft: 0, gravel: 1 };");
    expect(wizard).toMatch(/steepnessLimit: STEEPNESS_LIMIT\.hasOwnProperty\(w\.terrainTol\)/);
    // No answer yet means no cap, as before the question counted.
    expect(wizard).toContain("terrainTol: 'any', heat: false");
    expect(wizard).not.toMatch(/paws handle|Soft ground only|including rock/);
  });

  test('the answer reaches the engine and can only lower the limit', () => {
    const profile = { fitness:'moderate', ageBand:'3-4', weightBand:'20-30', conditions:[] };
    const limit = steepness => engine.steepnessLimit(adapters.normalizeDog({ ...profile, steepnessLimit:steepness }));
    expect(limit(undefined)).toBe(2);
    expect(limit(null)).toBe(2);
    expect(limit(1)).toBe(1);
    expect(limit(0)).toBe(0);
    expect(limit(2)).toBe(2);
    expect(limit('0')).toBe(2);
    // A senior is already limited to moderately steep: "Steep is fine" can't lift that.
    const senior = { ...profile, ageBand:'9-10' };
    expect(engine.steepnessLimit(adapters.normalizeDog(senior))).toBe(1);
    expect(engine.steepnessLimit(adapters.normalizeDog({ ...senior, steepnessLimit:0 }))).toBe(0);
  });
});
