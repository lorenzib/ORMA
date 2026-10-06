'use strict';

// cinque-torri-assisted sat unproposable at 88% coverage against a 90% bar,
// and the 12% was not a gap in the waymarking. 1,036 m of its 5.3 km is the
// 5 Torri chairlift from Bai de Dones to Rifugio Scoiattoli -- OSM way
// 900787867, aerialway=chair_lift. No hiking relation covers a cable, so the
// measurement was holding routes 424, 425 and 439 responsible for a lift.
//
// Measured on what is walked, the same three routes cover 93%.

const {riddenStretch,densify,ridesALift,discoverRouteComposite,metresBetween}=require('./workflows/discover-route-composite');

// A straight run roughly south-east, ~1 km, as the chairlift goes.
const line=(from,to,count)=>Array.from({length:count},(_,i)=>[
  from[0]+(to[0]-from[0])*i/(count-1), from[1]+(to[1]-from[1])*i/(count-1)]);
const BASE=[46.5185,12.0385];
const TOP=[46.5082,12.0465];
const LIFT={id:900787867,tags:{aerialway:'chair_lift',name:'5 Torri'},points:[BASE,TOP]};
const rides=(over={})=>({liftAccess:{type:'chairlift',dependency:'required',name:'5 Torri chairlift'},...over});

describe('a stretch that is ridden, not walked',()=>{
  test('a cable mapped as two nodes is still matched along its length',()=>{
    // The reason densify exists: the midpoint is 600 m from either end node.
    const mid=[(BASE[0]+TOP[0])/2,(BASE[1]+TOP[1])/2];
    expect(Math.min(metresBetween(mid,BASE),metresBetween(mid,TOP))).toBeGreaterThan(400);
    expect(densify(LIFT.points).some(vertex=>metresBetween(mid,vertex)<=60)).toBe(true);
  });

  test('the ride is found, and named from the way that carries it',()=>{
    const trail=rides({path:[...line(BASE,TOP,15),...line(TOP,[46.5075,12.0570],20)]});
    const ridden=riddenStretch(trail,[LIFT]);
    expect(ridden).toMatchObject({fromIndex:0,aerialway:'chair_lift',name:'5 Torri'});
    expect(ridden.metres).toBeGreaterThan(900);
    expect(ridden.toIndex).toBeGreaterThanOrEqual(14);
  });

  // Where the walk leaves the top station it is still within 60 m of the cable,
  // so the first strides off the chair fall inside the stretch. That is the
  // station, not a kilometre of waymarked path, and counting it with the ride
  // is the harmless side of the line to be on.
  test('the first strides off the chair go with the ride, not against the routes',()=>{
    const trail=rides({path:[...line(BASE,TOP,15),...line(TOP,[46.5075,12.0570],20)]});
    const ridden=riddenStretch(trail,[LIFT]);
    expect(ridden.toIndex-14).toBeLessThanOrEqual(3);
  });

  // The guard that matters. In a ski area a path often runs right under a
  // cable, and excusing that ground would hide a real gap in the waymarking.
  test('a lift the itinerary does not ride excuses nothing',()=>{
    const path=[...line(BASE,TOP,15),...line(TOP,[46.5075,12.0570],20)];
    expect(riddenStretch({path,liftAccess:{dependency:'optional',name:'nearby'}},[LIFT])).toBeNull();
    expect(riddenStretch({path},[LIFT])).toBeNull();
    expect(ridesALift({liftAccess:{dependency:'required'}})).toBe(true);
    expect(ridesALift({liftAccess:{dependency:'optional'}})).toBe(false);
  });

  test('and with no lift found, nothing is excused either',()=>{
    expect(riddenStretch(rides({path:line(BASE,TOP,15)}),[])).toBeNull();
    expect(riddenStretch(rides({path:line(BASE,TOP,15)}),null)).toBeNull();
  });

  // Scattered passes beneath a cable are not a ride.
  test('only one continuous stretch counts, the longest',()=>{
    const under=[46.5140,12.0425];
    const away=[46.4900,12.0900];
    const trail=rides({path:[under,away,away,away,...line(BASE,TOP,12)]});
    const ridden=riddenStretch(trail,[LIFT]);
    expect(ridden.pointCount).toBe(12);
    expect(ridden.fromIndex).toBe(4);
  });
});

describe('what the coverage figure then means',()=>{
  const relation=points=>({type:'relation',id:424,tags:{ref:'424'},members:points.map((_,i)=>({type:'way',ref:i+1}))});
  const payloadFor=points=>({elements:[relation(points),
    ...points.map((point,i)=>({type:'way',id:i+1,geometry:[{lat:point[0],lon:point[1]}]}))]});

  // A walk whose second half follows route 424 and whose first half is ridden.
  // The walked leg starts clear of the top station so the two are not adjacent.
  const walked=line([46.5090,12.0530],[46.5075,12.0640],20);
  const path=[...line(BASE,TOP,15),...walked];

  test('the ride leaves the denominator rather than counting as covered',()=>{
    const found=discoverRouteComposite(rides({path}),payloadFor(walked),{aerialways:[LIFT]});
    expect(found.coveragePercent).toBe(100);
    expect(found.walkedPointCount).toBe(walked.length);
    expect(found.riddenSegment).toMatchObject({pointCount:15,aerialway:'chair_lift'});
  });

  test('and the same walk measured whole falls short, which is what blocked it',()=>{
    const found=discoverRouteComposite({path},payloadFor(walked));
    expect(found.coveragePercent).toBeLessThan(90);
    expect(found.riddenSegment).toBeUndefined();
  });
});

describe('the cap on what a ride may excuse',()=>{
  const line=(from,to,count)=>Array.from({length:count},(_,i)=>[
    from[0]+(to[0]-from[0])*i/(count-1), from[1]+(to[1]-from[1])*i/(count-1)]);
  const BASE=[46.5185,12.0385];
  const TOP=[46.5082,12.0465];
  const LIFT={id:1,tags:{aerialway:'chair_lift',name:'5 Torri'},points:[BASE,TOP]};
  const rides=path=>({path,liftAccess:{dependency:'required',name:'5 Torri chairlift'}});

  test('the station approaches are within it, and reported beside the cable',()=>{
    const ridden=riddenStretch(rides(line(BASE,TOP,20)),[LIFT]);
    expect(ridden.metres).toBeGreaterThan(0);
    expect(ridden.metres).toBeLessThanOrEqual(ridden.cableMetres*1.5);
  });

  // A walk that shadows a cable there and back is not a ride, and excusing it
  // would hand the proposal a coverage figure it has not earned.
  test('a walk that shadows the cable out and back excuses nothing',()=>{
    const ridden=riddenStretch(rides([...line(BASE,TOP,20),...line(TOP,BASE,20)]),[LIFT]);
    expect(ridden).toBeNull();
  });
});
