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
