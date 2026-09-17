'use strict';

const {OFF_ROUTE_M,MIN_STRETCH_M,routeLinesFor,assessRouteConformance,
  routeConformanceBlockingReasons}=require('./services/route-conformance');
const {waivableBlocker,compileVerifiedDossier,routeConformanceOf}=require('./workflows/compile-verified-dossier');
const {declaredRefs,measureRouteConformance}=require('./workflows/run-cartographer');

// Coordinates are [lng, lat]. At this latitude a degree of longitude is about
// 77 km and a degree of latitude about 111 km, so the offsets below are chosen
// to be unambiguous in metres rather than convenient in degrees.
const LAT=46.62;
const M_PER_LNG=111320*Math.cos(LAT*Math.PI/180);
const east=metres=>metres/M_PER_LNG;
const north=metres=>metres/111132;

/** A straight run east from a fixed origin, one point every `stepM` metres. */
function line(lengthM,{offsetM=0,stepM=25}={}){
  const points=[];
  for(let along=0;along<=lengthM;along+=stepM) points.push([12.29+east(along),LAT+north(offsetM)]);
  return points;
}

const REFERENCE=line(4000);

describe('route conformance',()=>{
  test('a line drawn along the route it names passes',()=>{
    const result=assessRouteConformance(line(4000),[REFERENCE],{refs:['101']});
    expect(result.status).toBe('passed');
    expect(result.offRouteKm).toBe(0);
    expect(result.issues).toEqual([]);
  });

  // The case the existing checks all pass: a real, well-formed path that is
  // simply not the path the page tells the walker to follow.
  test('a line running parallel to the route it names is rejected',()=>{
    const result=assessRouteConformance(line(4000,{offsetM:120}),[REFERENCE],{refs:['101']});
    expect(result.status).toBe('rejected');
    expect(result.issues).toContain('off-declared-route');
    expect(result.maxOffsetM).toBeGreaterThan(100);
    expect(result.offRouteKm).toBeCloseTo(result.distanceKm,1);
  });

  test('it names where the line leaves the route, not just that it did',()=>{
    // On route for 2 km, 90 m off for 1 km, back on for 1 km.
    const drawn=[...line(2000),
      ...line(3000,{offsetM:90}).filter(p=>p[0]>12.29+east(2000)&&p[0]<=12.29+east(3000)),
      ...line(4000).filter(p=>p[0]>12.29+east(3000))];
    const result=assessRouteConformance(drawn,[REFERENCE],{refs:['101']});
    expect(result.status).toBe('rejected');
    expect(result.stretches).toHaveLength(1);
    const [stretch]=result.stretches;
    expect(stretch.startKm).toBeGreaterThan(1.9);
    expect(stretch.endKm).toBeLessThan(3.1);
    expect(stretch.maxOffsetM).toBeGreaterThan(80);
  });

  // Mapping noise between two renderings of the same path must not read as a
  // detour, or every trail fails and the gate gets switched off.
  test('a brief wobble is neither a stretch nor a failure',()=>{
    const drawn=line(4000).map((point,index)=>
      index===40||index===41?[point[0],point[1]+north(OFF_ROUTE_M+15)]:point);
    const result=assessRouteConformance(drawn,[REFERENCE],{refs:['101']});
    expect(result.status).toBe('passed');
    expect(result.stretches).toEqual([]);
    expect(result.offRouteKm*1000).toBeLessThan(MIN_STRETCH_M);
  });

  // Unchecked is not the same as clean. A route whose relations could not be
  // fetched has not been compared with anything, and passing it here is how an
  // unchecked route reaches a walker.
  test('nothing to compare against reports unknown, never passed',()=>{
    const result=assessRouteConformance(line(4000),[],{refs:['101']});
    expect(result.status).toBe('unknown');
    expect(result.issues).toContain('declared-route-unavailable');
    expect(routeConformanceBlockingReasons(result)).toEqual([]);
  });

  test('missing geometry reports unknown too',()=>{
    expect(assessRouteConformance([],[REFERENCE],{refs:['101']}).status).toBe('unknown');
  });

  // The share is of the walk, not of the vertices: a route drawn densely round
  // a hairpin and sparsely along a straight would otherwise let the hairpin
  // decide the verdict.
  test('the share is measured along the ground, not per point',()=>{
    // 200 m off-route drawn every 5 m (40 points), 3800 m on-route every 100 m
    // (38 points). By point count that is a majority off; by distance it is 5%.
    const dense=line(200,{offsetM:120,stepM:5});
    const sparse=line(4000,{stepM:100}).filter(point=>point[0]>12.29+east(200));
    const result=assessRouteConformance([...dense,...sparse],[REFERENCE],{refs:['101']});
    expect(result.offRouteShare).toBeLessThan(0.1);
    expect(result.status).toBe('passed');
  });

  describe('matching the declared refs',()=>{
    const payload={elements:[
      {type:'relation',id:1,tags:{ref:'101',route:'hiking'},members:[{type:'way',ref:11}]},
      {type:'relation',id:2,tags:{ref:' 105 ',route:'hiking'},members:[{type:'way',ref:12}]},
      {type:'relation',id:3,tags:{ref:'117;104',route:'hiking'},members:[{type:'way',ref:13}]},
      {type:'relation',id:4,tags:{ref:'AV4',route:'hiking'},members:[{type:'way',ref:14}]},
      {type:'way',id:11,geometry:[{lat:46.6,lon:12.2},{lat:46.61,lon:12.21}]},
      {type:'way',id:12,geometry:[{lat:46.7,lon:12.3},{lat:46.71,lon:12.31}]},
      {type:'way',id:13,geometry:[{lat:46.8,lon:12.4},{lat:46.81,lon:12.41}]},
      {type:'way',id:14,geometry:[{lat:46.9,lon:12.5},{lat:46.91,lon:12.51}]},
    ]};

    test('takes the member ways of every relation carrying a declared ref',()=>{
      expect(routeLinesFor(payload,['101','105'])).toHaveLength(2);
    });

    test('ignores the spacing and case a mapper happened to use',()=>{
      expect(routeLinesFor(payload,[' 105 '])).toHaveLength(1);
      expect(routeLinesFor(payload,['av4'])).toHaveLength(1);
    });

    test('reads a ref that shares its relation with others',()=>{
      expect(routeLinesFor(payload,['104'])).toHaveLength(1);
    });

    test('declaring nothing matches nothing, rather than everything',()=>{
      expect(routeLinesFor(payload,[])).toEqual([]);
    });

    test('converts Overpass lat/lon into the [lng, lat] the services use',()=>{
      expect(routeLinesFor(payload,['101'])[0][0]).toEqual([12.2,46.6]);
    });
  });

  // Route guidance is the one blocker the dossier lets no reason wave through.
  // Directions that lead off the route belong with it, so the reason is phrased
  // to fall on the unwaivable side of that test rather than near it.
  test('the blocking reason is one the dossier cannot waive',()=>{
    const rejected=assessRouteConformance(line(4000,{offsetM:120}),[REFERENCE],{refs:['101','105']});
    const [reason]=routeConformanceBlockingReasons(rejected);
    expect(reason).toContain('101, 105');
    expect(reason).toMatch(/km of .* km/);
    expect(waivableBlocker(reason)).toBe(false);
  });

  test('a passing assessment blocks nothing',()=>{
    expect(routeConformanceBlockingReasons(assessRouteConformance(line(4000),[REFERENCE],{refs:['101']}))).toEqual([]);
  });

  // The gate itself: a dossier carrying a failed comparison must not compile,
  // however complete the rest of it is.
  describe('at the verification gate',()=>{
    const AT='2026-09-17T10:00:00.000Z';
    const source=[{label:'Official route',url:'https://example.test/route',authority:'Park authority',accessedAt:AT}];
    const claim=(id,proposedValue)=>({id,category:'access',proposedValue,finding:'supported-proposal',
      confidence:.95,rationale:'The official route page states it.',sources:source,blockers:[]});
    const reviewWith=conformance=>({
      reviewId:'dossier-x',candidateId:'trail-x',approvalAllowed:true,specialistOutputs:[
        {agentId:'cartographer',jobId:'cart-x',result:{
          source:{provider:'OSM',url:'https://example.test/route',endpoint:'https://example.test/raw',
            externalId:'relation/1',relationVersion:2,licence:'ODbL-1.0'},
          relation:{tags:{name:'Trail X'}},geometry:{type:'LineString',coordinates:[[1,1],[1,1]]},
          assessment:{pointCount:2,distanceKm:1},
          ...(conformance?{routeConformance:conformance}:{})}},
        {agentId:'logistics',jobId:'log-x',result:{claims:[
          claim('parking','Use P1.'),claim('recommended-start','Start at the hut, 46.0000, 11.0000.'),
          claim('route-number-status','Numbered route.'),claim('route-number-sequence','Follow 101 then 105.'),
          claim('route-number-switches','Switch at the hut.')]}},
      ]});
    const trail={candidateId:'trail-x',trailId:'trail-x',trailName:'Trail X'};
    const measure=offsetM=>assessRouteConformance(line(4000,{offsetM}),[REFERENCE],{refs:['101','105']});

    test('a line that follows its routes compiles',()=>{
      expect(()=>compileVerifiedDossier(reviewWith(measure(0)),trail,{at:AT,verifiedBy:'editor'})).not.toThrow();
    });

    test('a line that leaves its routes cannot be verified',()=>{
      expect(()=>compileVerifiedDossier(reviewWith(measure(120)),trail,{at:AT,verifiedBy:'editor'}))
        .toThrow(/Trail X cannot be verified.*leaves 101, 105/);
    });

    // Every trail verified before the measurement existed carries none, and the
    // gate must not read that silence as a pass or as a failure.
    test('a dossier with no measurement still compiles, and says so',()=>{
      const review=reviewWith(null);
      expect(routeConformanceOf(review)).toBeNull();
      expect(()=>compileVerifiedDossier(review,trail,{at:AT,verifiedBy:'editor'})).not.toThrow();
    });

    test('an unmeasurable comparison does not block either',()=>{
      const review=reviewWith(assessRouteConformance(line(4000),[],{refs:['101']}));
      expect(routeConformanceOf(review).status).toBe('unknown');
      expect(()=>compileVerifiedDossier(review,trail,{at:AT,verifiedBy:'editor'})).not.toThrow();
    });
  });

  // Where the measurement is taken. Two coordinate orders meet here: the
  // geometry is GeoJSON lng,lat and the Overpass corridor is lat,lon, and
  // getting that backwards looks for routes in the wrong hemisphere and
  // reports a clean 'unknown' rather than an error.
  describe('taking the measurement in the cartographer',()=>{
    const relation={tags:{ref:'101;105'}};
    const coordinates=line(2000);          // [lng, lat], around 12.29E 46.62N

    test('reads every number the relation declares',()=>{
      expect(declaredRefs(relation)).toEqual(['101','105']);
      expect(declaredRefs({tags:{ref:' 101 '}})).toEqual(['101']);
      expect(declaredRefs({tags:{}})).toEqual([]);
    });

    test('a route declaring no number is not measured against one',async()=>{
      expect(await measureRouteConformance(coordinates,{tags:{}},{})).toBeNull();
    });

    test('the corridor it looks along is lat,lon, not the geometry order',async()=>{
      let seen=null;
      await measureRouteConformance(coordinates,relation,{
        fetchRoutesNearPath:async path=>{ seen=path; return {payload:{elements:[]}}; }});
      expect(seen[0][0]).toBeCloseTo(coordinates[0][1],6);   // lat first
      expect(seen[0][1]).toBeCloseTo(coordinates[0][0],6);   // lon second
      expect(seen[0][0]).toBeGreaterThan(40);                // a latitude, not a longitude
    });

    test('an Overpass outage leaves the comparison unknown, and says why',async()=>{
      const result=await measureRouteConformance(coordinates,relation,{
        fetchRoutesNearPath:async()=>{ throw new Error('Overpass returned HTTP 504'); }});
      expect(result.status).toBe('unknown');
      expect(result.lookupError).toContain('504');
      expect(routeConformanceBlockingReasons(result)).toEqual([]);
    });

    test('it measures against the relations carrying the declared numbers',async()=>{
      const payload={elements:[
        {type:'relation',id:1,tags:{ref:'101'},members:[{type:'way',ref:11}]},
        {type:'way',id:11,geometry:line(2000,{offsetM:150}).map(([lng,lat])=>({lon:lng,lat}))},
      ]};
      const result=await measureRouteConformance(coordinates,relation,{
        fetchRoutesNearPath:async()=>({payload})});
      expect(result.status).toBe('rejected');
      expect(result.refs).toEqual(['101','105']);
      expect(result.maxOffsetM).toBeGreaterThan(100);
    });
  });
});
