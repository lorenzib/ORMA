const fs=require('fs');
const {locateOnRoute,describeLocation,MAX_OFF_ROUTE_M}=require('./hazard-location.js');

function realTrail(id){
  const src=fs.readFileSync('data/regions/dolomites-trails.js','utf8');
  const trails=JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]);
  const trail=trails.find(item=>item.id===id);
  if(!trail)throw new Error(`fixture trail ${id} is gone`);
  return trail;
}

// A 1 km line due north. Exact geometric claims are made here, because on a real
// loop the return leg runs within metres of the outbound one, so "beside the
// path" is genuinely ambiguous there — as it should be.
const STRAIGHT_KM=[[46.500,11.600],[46.509,11.600]];

describe('projecting a point onto a route', () => {
  test('the midpoint of a 1 km line is at km 0.5', () => {
    expect(locateOnRoute({lat:46.5045,lng:11.600},STRAIGHT_KM))
      .toEqual({lat:46.5045,lng:11.6,km:0.5,offRouteM:0,onRoute:true});
  });

  test('a point beside the line snaps onto it, keeping how far off it was', () => {
    const located=locateOnRoute({lat:46.5045,lng:11.6013},STRAIGHT_KM);
    expect(located.km).toBe(0.5);
    expect(located.lng).toBe(11.6);
    expect(located.offRouteM).toBe(99);
    expect(located.onRoute).toBe(true);
  });

  test('a point in the wrong valley is not on this route', () => {
    const located=locateOnRoute({lat:46.7,lng:11.9},STRAIGHT_KM);
    expect(located.onRoute).toBe(false);
    expect(located.offRouteM).toBeGreaterThan(MAX_OFF_ROUTE_M);
  });
});

describe('on a real mapped trail', () => {
  const trail=realTrail('giro-del-bulacia');

  test('a pin on the first path point is at the start', () => {
    const located=locateOnRoute(trail.path[0],trail.path);
    expect(located.km).toBe(0);
    expect(located.onRoute).toBe(true);
    expect(describeLocation(located)).toBe('At the start of the route');
  });

  test('every path point lands on the route, in order, within its length', () => {
    const marks=trail.path.map(pointOnPath=>locateOnRoute(pointOnPath,trail.path));
    expect(marks.every(mark=>mark.offRouteM<=1)).toBe(true);
    // The last point of a loop returns to the start, so distance along the path
    // is compared against the walked length rather than assumed to increase.
    expect(Math.max(...marks.map(mark=>mark.km))).toBeLessThanOrEqual(trail.distance*1.15);
    const quarter=marks[Math.floor(marks.length/4)];
    const half=marks[Math.floor(marks.length/2)];
    expect(half.km).toBeGreaterThan(quarter.km);
  });

  test('both coordinate shapes are accepted', () => {
    const [lat,lng]=trail.path[7];
    expect(locateOnRoute({lat,lng},trail.path)).toEqual(locateOnRoute([lat,lng],trail.path));
  });
});

// A hazard must never carry a position that was invented rather than measured.
describe('refusing to invent a position', () => {
  test.each([
    ['no path',{lat:46.5,lng:11.6},[]],
    ['a single point',{lat:46.5,lng:11.6},[[46.5,11.6]]],
    ['no coordinate',null,STRAIGHT_KM],
    ['a non-numeric coordinate',{lat:'x',lng:11.6},STRAIGHT_KM],
    ['an out-of-range coordinate',{lat:200,lng:11.6},STRAIGHT_KM],
  ])('%s yields no location', (_label,coordinate,path) => {
    expect(locateOnRoute(coordinate,path)).toBeNull();
  });

  test('an unlocated hazard is described as nothing, not as km zero', () => {
    expect(describeLocation(null)).toBeNull();
    expect(describeLocation({km:null})).toBeNull();
    expect(describeLocation({})).toBeNull();
  });
});

describe('how a located hazard reads', () => {
  test.each([
    [0.02,'At the start of the route'],
    [1.84,'About 1.8 km along the route'],
    [12.4,'About 12 km along the route'],
  ])('km %s reads as "%s"', (km,expected) => {
    expect(describeLocation({km})).toBe(expected);
  });
});
