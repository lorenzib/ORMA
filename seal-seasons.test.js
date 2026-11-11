const { LIFT_WORDS, audit } = require('./scripts/check-seal-seasons');
const { steps } = require('./scripts/run-quality-gate');

// A verified walk's hard seasonal limits are settled before it keeps the seal:
// ski and sled runs leave winter out of its best months, a lift it names is
// declared or checked as not ridden, and a lift it needs has dates or a reason.
describe('seasonal limits for the Verified seal', () => {
  test('every verified walk has its seasonal limits settled', () => {
    const result = audit(__dirname);
    expect(result.verified).toBeGreaterThan(400);
    expect(result.problems).toEqual([]);
  });

  test('lift words catch lifts, not lifting a dog', () => {
    expect(LIFT_WORDS.test('Ride the Rotwand gondola up from Bad Moos')).toBe(true);
    expect(LIFT_WORDS.test('the top of the Vinouve chairlift')).toBe(true);
    expect(LIFT_WORDS.test('Prendi la funivia per Aschbach')).toBe(true);
    expect(LIFT_WORDS.test('Lift your dog over the cattle grid.')).toBe(false);
    expect(LIFT_WORDS.test('arrange a lift or bus back')).toBe(false);
  });

  test('runs in the quality gate', () => {
    expect(steps.map(([label]) => label)).toContain('Seasonal limits for the Verified seal');
  });

  test('the three walks that ride a lift and had no lift record now have one', () => {
    const access = require('./data/lift-access.json').trails;
    const seasons = require('./data/lift-seasons.json');
    for(const id of ['osm-1116675', 'osm-6401355', 'osm-14376573']){
      expect(access.find(entry => entry.id === id).fields.liftAccess.dependency).toBe('required');
      expect(Boolean(seasons.trails[id] || seasons.held[id])).toBe(true);
    }
  });
});
