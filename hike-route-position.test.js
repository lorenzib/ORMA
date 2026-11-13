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

  test('a there-and-back drawn both ways is not halved', () => {
    // The Tre Cime board walks and board lines built --there-and-back are
    // stored out and back again, so the line is already the whole walk.
    expect(source).toContain("trail.routeShape === 'out-and-back' && !closes");
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

// Live hike mode, driven fix by fix the way the phone drives it. A there-and-
// back drawn out and back over one path (61 closed walks), and a lollipop's
// stem, cross the same ground twice. Placing each fix on the nearest point of
// the line put the whole way home on the way out: coverage stalled near half,
// the recording never ended itself, and the km readout ran backwards.
describe('a live recording on a line that doubles back', () => {
  const vmContext=require('vm');
  const M_PER_DEG=111000;
  const metres=(a, b) => Math.hypot((b[0]-a[0])*M_PER_DEG, (b[1]-a[1])*M_PER_DEG*Math.cos(a[0]*Math.PI/180));

  function realTrail(id){
    const sandbox={window:{trails:[], gondolas:[]}};
    vmContext.runInNewContext(fs.readFileSync(`data/trail-details/${id}.js`,'utf8'), sandbox);
    return sandbox.window.trails.find(trail => trail.id===id);
  }

  // A fix every 15 m along the given points.
  function every15m(points){
    const fixes=[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1], b=points[i];
      const n=Math.max(1, Math.ceil(metres(a, b)/15));
      for(let k=0;k<n;k++) fixes.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]);
    }
    fixes.push(points[points.length-1]);
    return fixes;
  }

  // Start a hike on the trail and walk the given points at 3.6 km/h.
  function record(trail, points){
    jest.useFakeTimers({now:new Date(2026, 10, 13, 9, 0)});
    for(const file of ['hike-gps-policy.js','route-rejoin.js','hike-distance.js','walk-proof.js','hike-session.js']){
      window.eval(fs.readFileSync(file,'utf8'));
    }
    window.t=key => key;
    const walks=[];
    window.DoloPawsCommunity={recordTrailWalk:(...args) => walks.push(args), recordHikeStart:() => Promise.resolve(true)};
    window.DoloPawsHikeCompletions={save:(session, done) => ({ok:true, record:{...done, startedAt:session.startedAt}})};
    const routeKm=[];
    window._dolopawsElevHighlight=km => routeKm.push(km);
    window.eval(`${fs.readFileSync('hike-mode.js','utf8')}\nwindow.__initHikeMode = initHikeMode;`);
    let onFix=null;
    Object.defineProperty(navigator,'geolocation',{configurable:true,
      value:{watchPosition:callback => { onFix=callback; return 1; }, clearWatch(){}}});
    const container=document.createElement('div');
    document.body.appendChild(container);
    window.__initHikeMode(null, trail, {container});
    container.querySelector('#mapStartHikeBtn').click();
    const shares=[];
    let finishedAt=null;
    every15m(points).forEach((point, i) => {
      if(finishedAt!==null) return;
      jest.advanceTimersByTime(15000);
      onFix({coords:{latitude:point[0], longitude:point[1], accuracy:5}, timestamp:Date.now()});
      shares.push(window.DoloPawsWalkProof.share(JSON.parse(localStorage.getItem('orma-walk-coverage-v1')).coverage));
      jest.advanceTimersByTime(0);
      if(!container.classList.contains('hk-live')) finishedAt=i;
    });
    return {walks, routeKm, shares, finished:finishedAt!==null, container};
  }

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
    document.body.innerHTML='';
  });

  test('Castello di Botestagno walked out and home is proven and ends itself', () => {
    const trail=realTrail('cortina-castello-di-botestagno');
    expect(trail.routeShape).toBe('out-and-back');
    // Drawn out and back over one path: the line closes and is the whole walk.
    expect(metres(trail.path[0], trail.path[trail.path.length-1])).toBeLessThan(75);
    const walk=record(trail, trail.path);
    expect(walk.finished).toBe(true);
    expect(Math.max(...walk.shares)).toBeGreaterThanOrEqual(0.95);
    expect(walk.walks).toEqual([[trail.id, expect.anything(), 'gps']]);
  });

  test('the km readout counts on down the way home', () => {
    const trail=realTrail('cortina-castello-di-botestagno');
    const walk=record(trail, trail.path);
    const km=walk.routeKm;
    // The line is the whole walk, so the readout runs from 0 to its stated length...
    expect(km[0]).toBeLessThan(0.1);
    expect(km[km.length-1]).toBeGreaterThan(trail.distance-0.15);
    // ...and never runs backwards by more than GPS wobble.
    let low=Infinity;
    for(let i=km.length-1;i>=0;i--){
      expect(km[i]).toBeLessThanOrEqual(low+0.05);
      low=Math.min(low, km[i]);
    }
  });

  test('turning back halfway is neither proven nor finished', () => {
    const trail=realTrail('cortina-castello-di-botestagno');
    const half=trail.path.slice(0, Math.floor(trail.path.length/4));
    const walk=record(trail, half.concat(half.slice(0, -1).reverse()));
    expect(walk.finished).toBe(false);
    expect(Math.max(...walk.shares)).toBeLessThan(0.75);
  });

  test('a lollipop walked up the stem, round and down again is proven and ends itself', () => {
    const trail=realTrail('cembra-castello-segonzano');
    expect(trail.routeShape).toBe('lollipop');
    const walk=record(trail, trail.path);
    expect(walk.finished).toBe(true);
    expect(walk.walks).toEqual([[trail.id, expect.anything(), 'gps']]);
  });

  test('a loop still records and ends itself as before', () => {
    const trail=realTrail('lago-carezza');
    const walk=record(trail, trail.path);
    expect(walk.finished).toBe(true);
    expect(walk.walks).toEqual([[trail.id, expect.anything(), 'gps']]);
  });

  test('a resumed hike picks up where it was placed on the line', () => {
    const source=fs.readFileSync('hike-mode.js','utf8');
    expect(source).toContain('walkProof.createPlacement(coverage && coverage.lastAlongM)');
  });
});
