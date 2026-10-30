const bar = require('./board-walk-bar');

// A line in metres east/north of a point near Ortisei, as [lat, lng].
const ORIGIN = [46.57, 11.67];
const at = (east, north) => [
  ORIGIN[0] + north / 111195,
  ORIGIN[1] + east / (111195 * Math.cos(ORIGIN[0] * Math.PI / 180)),
];
const walk = (...corners) => corners.map(([e, n]) => at(e, n));

describe('the line check', () => {
  const square = walk([0, 0], [400, 0], [400, 400], [0, 400], [0, 0]);

  test('a plain loop is clean', () => {
    const result = bar.lineShape(square, { declared: 'loop' });
    expect(result.kind).toBe('clean');
    expect(result.clean).toBe(true);
  });

  test('a loop that runs 200 m up a side street and back folds, and says where', () => {
    const line = walk([0, 0], [200, 0], [200, -200], [200, 0], [400, 0], [400, 400], [0, 400], [0, 0]);
    const result = bar.lineShape(line, { declared: 'loop' });
    expect(result.kind).toBe('folds');
    expect(result.clean).toBe(false);
    expect(result.spurs).toHaveLength(1);
    expect(result.spurs[0].km).toBeCloseTo(0.4, 1);
    expect(result.problems[0]).toMatch(/comes straight back once mid-walk, at km 0\.40 \(200 m\)/);
  });

  test('the same detour declared as a side trip is accepted', () => {
    const line = walk([0, 0], [200, 0], [200, -200], [200, 0], [400, 0], [400, 400], [0, 400], [0, 0]);
    const result = bar.lineShape(line, { declared: 'loop', sideTrips: [{ km: 0.4, note: 'to the waterfall and back' }] });
    expect(result.clean).toBe(true);
    expect(result.sideTrips).toHaveLength(1);
  });

  test('a step out and back no longer than a snap is not a spur', () => {
    const line = walk([0, 0], [200, 0], [200, -40], [200, 0], [400, 0], [400, 400], [0, 400], [0, 0]);
    expect(bar.lineShape(line, { declared: 'loop' }).clean).toBe(true);
  });

  test('a mountain hairpin, two paths 8 m apart, is not a spur', () => {
    const line = walk([0, 0], [300, 0], [304, 4], [300, 8], [0, 8], [0, 300], [300, 300]);
    expect(bar.lineShape(line, { declared: 'point-to-point' }).kind).toBe('clean');
  });

  test('an out-and-back is clean when the page says so, and wrong when it says loop', () => {
    const line = walk([0, 0], [600, 0], [600, 400], [600, 0], [0, 0]);
    expect(bar.lineShape(line, { declared: 'out-and-back' }).clean).toBe(true);
    const asLoop = bar.lineShape(line, { declared: 'loop' });
    expect(asLoop.kind).toBe('out-and-back');
    expect(asLoop.problems[0]).toMatch(/is an out-and-back .* but the page calls the walk a loop/);
  });

  test('an out-and-back with a fold of its own still folds', () => {
    const line = walk([0, 0], [300, 0], [300, -200], [300, 0], [600, 0], [600, 400], [600, 0], [0, 0]);
    expect(bar.lineShape(line, { declared: 'out-and-back' }).kind).toBe('folds');
  });

  test('a loop on a stem is a lollipop, accepted only when declared', () => {
    const line = walk([0, 0], [300, 0], [700, 0], [700, 400], [300, 400], [300, 0], [0, 0]);
    expect(bar.lineShape(line, { declared: 'lollipop' }).clean).toBe(true);
    const asLoop = bar.lineShape(line, { declared: 'loop' });
    expect(asLoop.kind).toBe('lollipop');
    expect(asLoop.clean).toBe(false);
  });

  test('a figure of eight that walks its middle path twice overlaps', () => {
    const line = walk([0, 0], [400, 0], [400, 200], [0, 200], [0, 400], [400, 400], [400, 200], [0, 200], [0, 0]);
    expect(bar.lineShape(line, { declared: 'loop' }).kind).toBe('overlaps');
  });
});

describe('the directions check', () => {
  test('no directions, or only "follow the signs", is not enough', () => {
    expect(bar.directionsOf({}).written).toBe(false);
    expect(bar.directionsOf({ routeAudit: { routeNumbers: 'Follow the signs.' } }).written).toBe(false);
  });

  test('a start and the way on, with numbers or named turns, is', () => {
    const trail = { routeAudit: { routeNumbers: 'Paths 30B, 23 and 528: from Ortisei along the old railway path towards Santa Cristina, onto path 30B up to Monte Pana, then path 23 to the Rifugio Comici.' } };
    expect(bar.directionsOf(trail).written).toBe(true);
  });
});

// Every Verified board walk clears the bar. When it was introduced on 28
// October 2026, 67 walks lost the seal that day; on 29 October the owner
// withdrew the other 148, because none showed directions on its page. Nothing
// is waiting: a walk that fails the bar is not published Verified.
const AWAITING_DECISION = [];

describe('every Verified board walk clears the bar', () => {
  const results = bar.audit();

  test('a walk that fails is one already awaiting a decision', () => {
    const failing = results.filter(result => !result.passes)
      .filter(result => !AWAITING_DECISION.includes(result.id))
      .map(result => `${result.id}: ${[...result.line.problems, ...result.directions.problems].join('; ')}`);
    expect(failing).toEqual([]);
  });

  test('a walk awaiting a decision leaves the list once it passes or loses the seal', () => {
    const stillFailing = new Set(results.filter(result => !result.passes).map(result => result.id));
    expect(AWAITING_DECISION.filter(id => !stillFailing.has(id))).toEqual([]);
  });

  test('directions only in the research notes are not enough: the page must show them', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, 'board-walk-bar.js'), 'utf8');
    expect(source).toContain('passes: line.clean && directions.written && directions.shownOnPage');
  });

  test('Ortisei – Passo Sella, the walk this bar was set for, fails it on its spurs and is not Verified', () => {
    const routes = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'board-line-routes.geojson'), 'utf8'));
    const feature = routes.features.find(item => item.properties.trail_id === 'valgardena-escursione-ortisei-passo-sella');
    const line = bar.lineShape(feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]), { declared: 'point-to-point' });
    expect(line.kind).toBe('folds');
    expect(line.spurs.map(spur => spur.metres).some(metres => metres > 400)).toBe(true);
    expect(results.map(result => result.id)).not.toContain('valgardena-escursione-ortisei-passo-sella');
  });
});
