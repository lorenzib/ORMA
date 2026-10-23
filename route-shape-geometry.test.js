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
  // Nuvolau left this list on 2026-10-23. Its "out-and-back by path 452" line in
  // fact climbed path 438, the Ra Gusela via ferrata; the official walk is a
  // loop by 443, 439, 464 and 452, and that is what is drawn now.
  test('nuvolau is the official loop and never the via ferrata', () => {
    const trail=byId('nuvolau');
    expect(trail.routeShape).not.toBe('out-and-back');
    expect(km(trail.path[0], trail.path[trail.path.length-1])*1000).toBeLessThan(50);
    expect(trail.waymarkedRelations).not.toContain(2261098);
    expect(trail.tips).toMatch(/438/);
  });

  test.each(['cadini','lago-sorapis'])('%s is recorded as an out-and-back', id => {
    const trail=byId(id);
    expect(trail.routeShape).toBe('out-and-back');
    // The evidence that put it there: an open line about half the walk.
    const line=lineKm(trail.path);
    const gapM=km(trail.path[0], trail.path[trail.path.length-1])*1000;
    expect(gapM).toBeGreaterThan(300);
    expect(trail.distance/line).toBeGreaterThan(1.9);
    expect(trail.distance/line).toBeLessThan(2.2);
  });

  // prato-piazza was held out of this list because its old description called
  // it a loop returning on the Alta Via 3. That description had no source. The
  // tourism board's own route, checked by hand on 22 October 2026, is the
  // Plätzwiese to the Strudelkopf and back the same way, so it is declared an
  // out-and-back on that evidence, with the official line drawn one way.
  test('prato-piazza is an out-and-back because its official route says so', () => {
    const trail=byId('prato-piazza');
    expect(trail.routeShape).toBe('out-and-back');
    expect(trail.routeShapeNote).toMatch(/Strudelkopf/);
    expect(trail.distance/lineKm(trail.path)).toBeGreaterThan(1.9);
    expect(trail.distance/lineKm(trail.path)).toBeLessThan(2.2);
  });

  test('every declared out-and-back has a note saying why', () => {
    const overrides=require('./data/verified-trail-overrides.json');
    const shapes=overrides.trails.filter(entry => entry.verificationScope==='routeShape');
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    for(const entry of shapes){
      expect(typeof entry.fields.routeShapeNote).toBe('string');
      expect(entry.fields.routeShapeNote.trim().length).toBeGreaterThan(20);
    }
  });

  // Seeweg's line used to be drawn across a 3.12 km hole, and the hole was
  // ours: its 48 members are one connected network, a closed western loop with
  // an eastern lobe on two three-way junctions that a nose-to-tail stitcher
  // cannot reach. Traversed as a graph it is one line, so the distance and the
  // line now agree and there is nothing left to explain away.
  test('Seeweg is drawn as one line, the length of its own member ways', () => {
    const trail=byId('osm-3885162');
    expect(trail.osmGeometryGaps).toBeUndefined();
    const line=lineKm(trail.path);
    const longest=Math.max(...trail.path.slice(1).map((point,i) => km(trail.path[i],point)));
    // No jump: the widest step is a straight run of mapped path inside one
    // way, which simplification leaves as a single segment.
    expect(longest).toBeLessThan(0.6);
    // 11.75 km of member ways, checked against relation 3885162 on
    // 20 Oct 2026. The line is the walk, so the distance is the line.
    expect(line).toBeCloseTo(trail.distance, 1);
    expect(trail.distance).toBeGreaterThan(11);
    expect(trail.distance).toBeLessThan(12);
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
    // Alpe di Siusi left this list on 2026-10-06: its catalogue distance was a
    // 7.5 km hand estimate; the composite the geometry gate measured is 5.5 km.
    // Lago di Carezza and Prato Piazza left it on 2026-10-22, when their
    // lines were rebuilt on OSM ways along the official routes.
    expect(unexplained).toEqual([
      'cinque-torri-assisted','geotrail-bulla',
    ]);
  });
});
