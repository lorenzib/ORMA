const fs=require('fs');
const vm=require('vm');
const {expectBundled}=require('./test-support/trail-runtime.js');

// hike-mode computed route position as (progress / drawnLine) * statedDistance.
// On a there-and-back the drawn line is one leg, so that fraction reached 1 at
// the turnaround and the walker was told they had finished the walk with the
// whole return still ahead. It also drove the elevation cursor and the
// next-water and next-hut readouts, so those skipped points not yet reached.
function load(){
  const source=fs.readFileSync('hike-mode.js','utf8');
  const context={window:{},navigator:{},document:{}};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__fn = hikeRoutePositionKm;`, context);
  return context.__fn;
}

describe('where along the walk a position on the line is', () => {
  const position=load();
  // Rifugio Nuvolau: 5.5 km there and back, drawn once as a 2.65 km line.
  const nuvolau={totalMeters:2650, statedKm:5.5, outAndBack:true};

  test('the turnaround is halfway, not the finish', () => {
    const atTurn=position({...nuvolau, routeProgressM:2650, furthestRouteM:2650});
    expect(atTurn).toBeCloseTo(2.75, 2);
  });

  test('the way out counts up to the turnaround', () => {
    expect(position({...nuvolau, routeProgressM:0, furthestRouteM:0})).toBeCloseTo(0, 3);
    expect(position({...nuvolau, routeProgressM:1325, furthestRouteM:1325})).toBeCloseTo(1.375, 2);
  });

  test('the way back counts on towards the finish', () => {
    // Halfway back down the line, having been to the end.
    const halfBack=position({...nuvolau, routeProgressM:1325, furthestRouteM:2650});
    expect(halfBack).toBeCloseTo(4.125, 2);
    // Back at the start, having been to the end: the walk is done.
    const home=position({...nuvolau, routeProgressM:0, furthestRouteM:2650});
    expect(home).toBeCloseTo(5.5, 2);
  });

  test('a fix wobbling at the turn does not flip the readout', () => {
    // 100 m back from the furthest point is inside the margin, so still outbound.
    const wobble=position({...nuvolau, routeProgressM:2550, furthestRouteM:2650});
    expect(wobble).toBeCloseTo(2.646, 2);
    // 200 m back is a genuine return.
    const back=position({...nuvolau, routeProgressM:2450, furthestRouteM:2650});
    expect(back).toBeGreaterThan(2.75);
  });

  test('any other shape is unchanged: the line is the walk', () => {
    const loop={totalMeters:7500, statedKm:7.5, outAndBack:false};
    expect(position({...loop, routeProgressM:0})).toBeCloseTo(0, 3);
    expect(position({...loop, routeProgressM:3750})).toBeCloseTo(3.75, 2);
    expect(position({...loop, routeProgressM:7500})).toBeCloseTo(7.5, 2);
  });

  test('nothing divides by zero on a degenerate route', () => {
    expect(position({})).toBe(0);
    expect(position({totalMeters:0, statedKm:0, routeProgressM:0})).toBe(0);
  });
});

describe('loop handling reads the declared shape', () => {
  const source=fs.readFileSync('hike-mode.js','utf8');

  test('a declared shape decides, and closure is only the fallback', () => {
    expect(source).toContain("trail.routeShape === 'loop'");
    expect(source).toMatch(/trail\.routeShape\s*\n?\s*\?\s*trail\.routeShape === 'loop'/);
  });

  test('a resumed walk remembers how far out it got', () => {
    // Otherwise the return leg reads as outbound until the walker gets past
    // wherever the app restarted.
    expect(source).toContain('furthestRouteM = progress && cum[lastIdx] !== undefined');
  });

  test('hike-mode ships in the trail bundle', () => {
    expectBundled('hike-mode.js');
  });
});
