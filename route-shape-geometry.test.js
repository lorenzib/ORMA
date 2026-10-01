const {loadProductionTrails}=require('./scripts/load-production-trails.js');

// A published distance that disagrees with the route drawn for it is either a
// wrong number or an unfinished line, and the two need opposite fixes. Eight
// trails disagreed by 20% or more. Four sat at almost exactly 2x, which is what
// an out-and-back traced one way looks like -- but only three of those four
// actually are out-and-backs. prato-piazza's own description calls it "a loop
// ... returning across the plateau on the Alta Via 3 path", so its line is an
// unfinished loop and doubling it back on itself would draw a walk nobody takes.
const km=(a,b)=>Math.hypot((a[0]-b[0])*111.2,(a[1]-b[1])*Math.cos(a[0]*Math.PI/180)*111.2);
const lineKm=path=>path.reduce((total,point,i)=>i?total+km(path[i-1],point):0,0);

const trails=loadProductionTrails(process.cwd());
const byId=id=>trails.find(trail=>trail.id===id);

describe('a route’s shape is declared, not guessed from its geometry', () => {
  test.each(['cadini','lago-sorapis','nuvolau'])('%s is recorded as an out-and-back', id => {
    const trail=byId(id);
    expect(trail.routeShape).toBe('out-and-back');
    // The evidence that put it there: an open line about half the walk.
    const line=lineKm(trail.path);
    const gapM=km(trail.path[0], trail.path[trail.path.length-1])*1000;
    expect(gapM).toBeGreaterThan(300);
    expect(trail.distance/line).toBeGreaterThan(1.9);
    expect(trail.distance/line).toBeLessThan(2.2);
  });

  test('prato-piazza is left alone, because it is a loop with an unfinished line', () => {
    const trail=byId('prato-piazza');
    expect(trail.desc).toMatch(/^A loop/);
    // Declaring it out-and-back to make the arithmetic work would assert a
    // walk its own description contradicts.
    expect(trail.routeShape).not.toBe('out-and-back');
  });

  test('every declared out-and-back has a note saying why', () => {
    const overrides=require('./data/verified-trail-overrides.json');
    const shapes=overrides.trails.filter(entry => entry.verificationScope==='routeShape');
    expect(shapes.length).toBeGreaterThanOrEqual(4);
    for(const entry of shapes){
      expect(typeof entry.fields.routeShapeNote).toBe('string');
      expect(entry.fields.routeShapeNote.trim().length).toBeGreaterThan(20);
    }
  });

  // The remaining disagreements are known and unexplained rather than fixed, so
  // the count is pinned: a new one should be looked at, not absorbed.
  test('no trail outside the known set disagrees with its own line by 20%', () => {
    const unexplained=trails.filter(trail => {
      if(!Array.isArray(trail.path) || trail.path.length<2) return false;
      const line=lineKm(trail.path);
      if(!line || !Number.isFinite(trail.distance)) return false;
      if(trail.routeShape==='out-and-back') return false;
      return Math.abs(trail.distance/line-1) >= 0.2;
    }).map(trail => trail.id).sort();
    expect(unexplained).toEqual([
      'alpe-siusi','cinque-torri-assisted','geotrail-bulla','lago-carezza','prato-piazza',
    ]);
  });
});
