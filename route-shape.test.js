const { assessGeometry, ROUTE_SHAPES } = require('./backoffice/services/geometry-validator');
const { applyVerifiedTrailOverrides } = require('./scripts/verified-trail-overrides');

// The geometry check faulted every route that did not return to its start, so an
// out-and-back was rejected as broken geometry and never reached verification.
// Whether a walk is meant to close is not something the coordinates can say: a
// route that retraces its outward leg looks the same as one that failed to
// close. So it is declared, and the check reads the declaration.

const openRoute = [[11.60, 46.50], [11.62, 46.52], [11.64, 46.54]];
const closedRoute = [[11.60, 46.50], [11.62, 46.52], [11.64, 46.50], [11.60, 46.50]];

describe('a walk that does not return to its start', () => {
  test('is still faulted when nobody has said otherwise', () => {
    // The default has to stay 'loop', or every existing trail changes meaning.
    expect(assessGeometry(openRoute).issues).toContain('not-closed-loop');
    expect(assessGeometry(openRoute).status).toBe('rejected');
  });

  test('passes once it is declared an out-and-back', () => {
    const result = assessGeometry(openRoute, { routeShape:'out-and-back' });
    expect(result.issues).not.toContain('not-closed-loop');
    expect(result.status).toBe('passed');
  });

  test('passes as a point-to-point too', () => {
    expect(assessGeometry(openRoute, { routeShape:'point-to-point' }).issues)
      .not.toContain('not-closed-loop');
  });

  test('the verdict says which shape it judged by', () => {
    expect(assessGeometry(openRoute, { routeShape:'out-and-back' }).routeShape).toBe('out-and-back');
    expect(assessGeometry(openRoute).routeShape).toBe('loop');
  });

  test('an unknown shape falls back to loop rather than passing everything', () => {
    // A typo must not silently disable the check.
    expect(assessGeometry(openRoute, { routeShape:'circular' }).issues).toContain('not-closed-loop');
  });

  test('declaring a shape does not suppress real geometry faults', () => {
    const tooShort = [[11.600, 46.500], [11.6001, 46.5001]];
    expect(assessGeometry(tooShort, { routeShape:'out-and-back' }).issues).toContain('implausibly-short');
  });

  test('a loop that does close is unaffected', () => {
    expect(assessGeometry(closedRoute).issues).not.toContain('not-closed-loop');
  });
});

describe('the declaration is a verified fact, not a flag', () => {
  const entry = (fields, scope='routeShape') => ({ trails:[{ id:'t1', verificationScope:scope, fields }] });

  test('a declared shape reaches the trail', () => {
    const [trail] = applyVerifiedTrailOverrides([{ id:'t1' }],
      entry({ routeShape:'out-and-back', routeShapeNote:'Signposted there and back from the church.' }));
    expect(trail.routeShape).toBe('out-and-back');
  });

  test('a shape without a reason is refused', () => {
    // An assertion nobody can check later is worse than none.
    expect(() => applyVerifiedTrailOverrides([{ id:'t1' }],
      entry({ routeShape:'out-and-back' }))).toThrow();
  });

  test('an invented shape is refused', () => {
    expect(() => applyVerifiedTrailOverrides([{ id:'t1' }],
      entry({ routeShape:'zigzag', routeShapeNote:'Because it wanders about.' }))).toThrow();
  });

  test('the shapes offered are the shapes the validator knows', () => {
    expect(ROUTE_SHAPES).toEqual(['loop','out-and-back','point-to-point']);
  });
});
