'use strict';

const {reconstructComposite,compareCoverage,pathToGeometry,MINIMUM_LIVE_COVERAGE_PERCENT}=require('./services/composite-geometry');
const {candidateFromProductionTrail}=require('./workflows/run-catalogue-batch');
const {runCartographer}=require('./workflows/run-cartographer');
const {compositeRelations,routeIdentityValue}=require('./workflows/compile-verified-dossier');

const RELATIONS=[
  {externalRelationId:'relation/9437572',ref:'30',name:null,coveragePercent:46,firstCoveredIndex:0},
  {externalRelationId:'relation/6865448',ref:'7',name:null,coveragePercent:42,firstCoveredIndex:3},
];
const composite=(over={})=>({state:'approved',trailName:'Alpe di Siusi Meadow Loop',
  coveragePercent:100,radiusMetres:60,relations:RELATIONS,approvedAt:'2026-09-06T09:59:37.348Z',...over});
// [lat, lng] -- the order the site stores paths in.
const path=Array.from({length:30},(_,index)=>[46.54+Math.sin(index/5)*0.01,11.62+index*0.0008]);
const trail=(over={})=>({id:'alpe-siusi',name:'Alpe di Siusi Meadow Loop',distance:9.2,path,...over});
const measured=(over={})=>({coveragePercent:100,radiusMetres:60,relations:RELATIONS,...over});

describe('a trail whose route identity is an approved composite',()=>{
  test('the candidate builds instead of throwing, which is the bug',()=>{
    // Six curated trails carry no relation and an approved composite instead.
    // plan-catalogue-campaign admits them on the strength of it; this threw
    // them out, and their jobs sat blocked on route-source-identity-unresolved
    // from 22 August.
    const candidate=candidateFromProductionTrail(trail(),{'alpe-siusi':composite()});
    expect(candidate.composite).toBeTruthy();
    expect(candidate.path).toBe(path);
  });

  test('a trail with neither a relation nor an approved composite still refuses',()=>{
    expect(()=>candidateFromProductionTrail(trail({id:'tre-cime'}),{})).toThrow('route-source-identity-unresolved');
    // A composite nobody approved is not a route source.
    expect(()=>candidateFromProductionTrail(trail(),{'alpe-siusi':composite({state:'proposed'})}))
      .toThrow('route-source-identity-unresolved');
  });

  test('the curated path is the geometry, flipped into GeoJSON order',()=>{
    // trail.path is [lat, lng]; geometry is [lng, lat]. Getting this backwards
    // silently produces a line in the Indian Ocean and zero coverage.
    const built=reconstructComposite(trail(),composite(),measured());
    expect(built.geometry.coordinates[0]).toEqual([path[0][1],path[0][0]]);
    expect(pathToGeometry([[46.5,11.6]])).toEqual([[11.6,46.5]]);
  });

  test('the identity is the routes, and the composite id is never offered as one',()=>{
    const built=reconstructComposite(trail(),composite(),measured());
    expect(built.relation.id).toBe('composite/alpe-siusi');
    expect(built.relation.tags.ref).toBe('30;7');
    expect(built.relation.memberRelationCount).toBe(2);
  });
});

describe('a composite is re-measured, never taken on trust',()=>{
  test('coverage that still holds passes',()=>{
    expect(compareCoverage(composite(),measured())).toEqual(expect.objectContaining({status:'holding',issues:[]}));
  });

  test('coverage that has fallen away blocks',()=>{
    const dropped=compareCoverage(composite(),measured({coveragePercent:40}));
    expect(dropped.status).toBe('degraded');
    expect(dropped.issues).toContain('composite-coverage-dropped');
    expect(dropped.liveCoveragePercent).toBe(40);
  });

  test('an approved route that has gone from OSM blocks even when coverage holds',()=>{
    // The identity a reader is shown is the list of numbers, and one of them
    // has stopped being true.
    const changed=compareCoverage(composite(),measured({relations:[RELATIONS[0]]}));
    expect(changed.issues).toContain('composite-relations-changed');
    expect(changed.missingRelations).toEqual(['relation/6865448']);
  });

  test('a measurement nobody could take is unmeasured, not degraded',()=>{
    // An Overpass outage is not evidence about a trail.
    const unmeasured=compareCoverage(composite(),null);
    expect(unmeasured.status).toBe('unmeasured');
    expect(unmeasured.issues).toEqual([]);
  });

  test('the live threshold is its own number, not the discovery one',()=>{
    expect(MINIMUM_LIVE_COVERAGE_PERCENT).toBe(90);
    expect(compareCoverage(composite(),measured({coveragePercent:95})).issues).toEqual([]);
    expect(compareCoverage(composite(),measured({coveragePercent:89})).issues).toContain('composite-coverage-dropped');
  });
});

describe('the cartographer run end to end',()=>{
  const payloadCovering=() => ({elements:[
    {type:'way',id:1,geometry:path.map(([lat,lon])=>({lat,lon}))},
    {type:'relation',id:9437572,tags:{ref:'30',route:'hiking',type:'route'},members:[{type:'way',ref:1}]},
    {type:'relation',id:6865448,tags:{ref:'7',route:'hiking',type:'route'},members:[{type:'way',ref:1}]},
  ]});

  test('it attests the composite and satisfies the result contract',async()=>{
    const candidate=candidateFromProductionTrail(trail(),{'alpe-siusi':composite()});
    const result=await runCartographer(candidate,{referenceMetrics:{distanceKm:null}},{
      fetchRoutesNearPath:async()=>({payload:payloadCovering()}),at:'2026-10-06T00:00:00Z'});
    expect(result.action).toBe('attest-approved-route-composite');
    expect(result.source.externalId).toBe('composite/alpe-siusi');
    // source.url must resolve to something a person can open.
    expect(result.source.url).toBe('https://www.openstreetmap.org/relation/9437572');
    expect(result.source.relations.map(relation=>relation.ref)).toEqual(['30','7']);
    expect(result.humanGate.id).toBe('geometry-approval');
    expect(result.coverage.liveCoveragePercent).toBe(100);
  });

  test('an Overpass failure leaves it unmeasured rather than condemned',async()=>{
    const candidate=candidateFromProductionTrail(trail(),{'alpe-siusi':composite()});
    const result=await runCartographer(candidate,{referenceMetrics:{distanceKm:null}},{
      fetchRoutesNearPath:async()=>{throw new Error('Overpass 504');},at:'2026-10-06T00:00:00Z'});
    expect(result.coverage.status).toBe('unmeasured');
    expect(result.blockers).not.toContain('composite-coverage-dropped');
  });

  test('a single-relation trail is untouched by any of this',async()=>{
    // The regression that matters: 153 trails go through the other branch.
    const single={id:'osm-123',name:'Ordinary trail',curated:false,distance:5,path};
    const candidate=candidateFromProductionTrail(single,{});
    expect(candidate.composite).toBeUndefined();
    expect(candidate.source.externalId).toBe('relation/123');
  });
});

describe('the dossier names what the route actually is',()=>{
  test('a composite cites every route it runs along',()=>{
    const result={source:{externalId:'composite/alpe-siusi',relations:RELATIONS},
      relation:{tags:{name:'Alpe di Siusi Meadow Loop'}}};
    // "composite/alpe-siusi" identifies nothing a walker could follow.
    expect(routeIdentityValue(result,{trailName:'x'},compositeRelations(result)))
      .toBe('Alpe di Siusi Meadow Loop · 2 approved route(s) along 30, 7');
  });

  test('a single relation still names itself, exactly as before',()=>{
    const result={source:{externalId:'relation/123'},relation:{tags:{name:'Tre Cime'}}};
    expect(routeIdentityValue(result,{trailName:'x'},compositeRelations(result))).toBe('Tre Cime · relation/123');
  });

  // Lago di Braies is covered end to end by one relation carrying no ref at
  // all, tagged `Seeweg` -- which is what the signs by the lake say. Citing
  // "relation/12043472" there is the composite label problem again, one level
  // down: it identifies the relation, not the route a walker follows.
  test('a route with no number is cited by its name, not its relation id',()=>{
    const result={source:{externalId:'composite/lago-braies',
      relations:[{externalRelationId:'relation/12043472',ref:null,name:'Seeweg',coveragePercent:100}]},
      relation:{tags:{name:'Lago di Braies Seeweg circuit'}}};
    expect(routeIdentityValue(result,{trailName:'x'},compositeRelations(result)))
      .toBe('Lago di Braies Seeweg circuit · 1 approved route(s) along Seeweg');
  });

  test('a number still wins over a name where there is one',()=>{
    const result={source:{externalId:'composite/mixed',relations:[
      {externalRelationId:'relation/1',ref:'105',name:'Rifugio traverse',coveragePercent:60},
      {externalRelationId:'relation/2',ref:null,name:'Seeweg',coveragePercent:40}]},
      relation:{tags:{name:'A walk'}}};
    expect(routeIdentityValue(result,{trailName:'x'},compositeRelations(result)))
      .toBe('A walk · 2 approved route(s) along 105, Seeweg');
  });

  test('and the id remains the last resort when a route has neither',()=>{
    const result={source:{externalId:'composite/bare',
      relations:[{externalRelationId:'relation/9',ref:null,name:null,coveragePercent:100}]},
      relation:{tags:{name:'A walk'}}};
    expect(routeIdentityValue(result,{trailName:'x'},compositeRelations(result)))
      .toBe('A walk · 1 approved route(s) along relation/9');
  });
});
