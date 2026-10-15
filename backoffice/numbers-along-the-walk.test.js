'use strict';

const {numbersAlongTheWalk,numberedWalkingRoute,isWalkingRoute,
  WALKING_ROUTES}=require('./workflows/numbers-along-the-walk');
const {routeGuidanceFromMap}=require('./workflows/route-guidance-from-map');
const {supportedRouteGuidance,routeGuidanceBlockingReasons}=require('./workflows/compile-verified-dossier');

// ORMA refused seven trails for want of route guidance after reading `ref` on
// their own relation and finding nothing. That tag says whether the walk is
// itself a numbered route; it says nothing about the waymarks a walker follows.
//
// Read properly on 15 October 2026, four of the six that could be read run
// along numbered walking routes: La Croix des Salles along 9 and 56, Le Marais
// de Pré Lombard along 23, 25 and 22, Le Mont d'Arbois along 2, 44, 54 and 56,
// Itinéraire de découverte historique along GR 96.
//
// Le Mont d'Arbois also has VAE 9, VAE 11 and VAE 69 along it -- e-bike routes
// -- and the member ways of these walks carry D 8, D 55 and D 309a, which are
// French départementale roads. Following either is the wrong way, and in the
// road's case a dangerous one.

// A walk heading east, a point every ~40 m, so a 150 m run is several points.
const walk=(count=60)=>Array.from({length:count},(_,i)=>[45.9,6.6+i*0.0005]);
const WALK=walk();

/** An Overpass payload the way fetchRoutesNearPath returns one. */
function payloadOf(...routes){
  const elements=[];let wayId=1000;
  for(const route of routes){
    const id=wayId+=1;
    elements.push({type:'way',id,geometry:route.points.map(([lat,lon])=>({lat,lon}))});
    elements.push({type:'relation',id:route.id,tags:route.tags,members:[{type:'way',ref:id}]});
  }
  return {elements};
}

const hiking=(id,ref,points,extra={})=>({id,points,
  tags:{type:'route',route:'hiking',ref,name:`Route ${ref}`,...extra}});

describe('the numbers running along a walk that carries none of its own',()=>{
  test('two waymarked routes, one handing over to the other, in order',()=>{
    // 9 carries the first half, 56 the second -- La Croix des Salles's shape.
    const first=WALK.slice(0,30);const second=WALK.slice(30);
    const measured=numbersAlongTheWalk(WALK,payloadOf(
      hiking(1,'9',first),hiking(2,'56',second)));
    expect(measured.sequence).toEqual(['9','56']);
    expect(measured.alongOtherRoutes).toBe(true);
    expect(measured.switches[0]).toMatchObject({from:'9',to:'56'});
    // Cited to the routes the numbers came from, not to the unnumbered walk.
    expect(measured.relations).toEqual([
      expect.objectContaining({ref:'9',externalRelationId:'relation/1'}),
      expect.objectContaining({ref:'56',externalRelationId:'relation/2'}),
    ]);
  });

  test('a cycle route along the walk is never offered to a walker',()=>{
    // VAE is vélo à assistance électrique. It is on the map, beside the path,
    // and it is not a footpath.
    const measured=numbersAlongTheWalk(WALK,payloadOf(
      {id:3,points:WALK,tags:{type:'route',route:'bicycle',ref:'VAE 9',name:'VAE 9'}},
      {id:4,points:WALK,tags:{type:'route',route:'mtb',ref:'VTT 2',name:'VTT 2'}}));
    expect(measured).toBeNull();
    expect(numberedWalkingRoute({tags:{type:'route',route:'bicycle',ref:'VAE 9'}})).toBeNull();
    expect(isWalkingRoute({type:'route',route:'bicycle'})).toBe(false);
    for(const kind of WALKING_ROUTES)expect(isWalkingRoute({type:'route',route:kind})).toBe(true);
  });

  test('a road number is never read, however near the walk it runs',()=>{
    // D 8, D 55 and D 309a sit on the member ways of these very walks.
    expect(numberedWalkingRoute({tags:{type:'route',route:'road',ref:'D 55'}})).toBeNull();
    // Nothing here reads a way's own ref, so a road tag on the path cannot
    // reach the claim at all.
    const roadsOnTheWay={elements:[
      {type:'way',id:1,tags:{highway:'track',ref:'D 8'},
        geometry:WALK.map(([lat,lon])=>({lat,lon}))},
    ]};
    expect(numbersAlongTheWalk(WALK,roadsOnTheWay)).toBeNull();
  });

  test('a route that merely crosses the walk is not a stretch of it',()=>{
    // Three points is well under the 150 m a run has to last.
    const crossing=WALK.slice(10,13);
    expect(numbersAlongTheWalk(WALK,payloadOf(hiking(5,'99',crossing)))).toBeNull();
  });

  test('an unnumbered route along the walk gives a walker nothing to follow',()=>{
    const nameOnly={id:6,points:WALK,tags:{type:'route',route:'hiking',name:'Sentier des Fleurs'}};
    expect(numbersAlongTheWalk(WALK,payloadOf(nameOnly))).toBeNull();
  });

  test('the value says it runs along them, never that it is one of them',()=>{
    // "Follow 23" of a walk that merely shares a stretch with 23 sends a
    // walker down 23 at the point the walk leaves it.
    const measured=numbersAlongTheWalk(WALK,payloadOf(
      hiking(1,'9',WALK.slice(0,30)),hiking(2,'56',WALK.slice(30))));
    const claims=routeGuidanceFromMap(measured,measured.relations,{at:'2026-10-15T12:00:00Z'});
    const sequence=claims['route-number-sequence'].proposedValue;
    expect(sequence).toContain('carries no route number of its own');
    expect(sequence).toContain('runs along waymarked routes 9 and then 56');
    expect(sequence).not.toMatch(/^Follow/);
    expect(sequence).toContain('Read from the OpenStreetMap route relations');
    expect(claims['route-number-switches'].proposedValue).toContain('waymarked route 9 gives way');
    expect(claims['route-number-sequence'].rationale).toContain('carries no number of its own');
    expect(claims['route-number-sequence'].sources[0]).toMatchObject({authority:'OpenStreetMap',
      url:'https://www.openstreetmap.org/relation/1'});
  });

  test('a walk that is itself numbered still reads as being that route',()=>{
    const own=routeGuidanceFromMap({sequence:['20'],switches:[],segments:[]},
      [{externalRelationId:'relation/11839597',ref:'20'}]);
    expect(own['route-number-sequence'].proposedValue)
      .toBe('The mapped route follows route 20 from end to end. '
        +'Read from the OpenStreetMap route relations this walk is built from, not from a published route description.');
    expect(own['route-number-switches'].proposedValue).toContain('stays on route 20 throughout');
  });

  test('the gate accepts the measurement as the two claims the map answers',()=>{
    const measured=numbersAlongTheWalk(WALK,payloadOf(
      hiking(1,'9',WALK.slice(0,30)),hiking(2,'56',WALK.slice(30))));
    // Stored exactly as the cartographer stores it.
    const outputs=[{agentId:'cartographer',result:{routeGuidance:measured,
      relation:{tags:{name:'La Croix des Salles'}},source:{externalId:'relation/11517208'}}}];
    const reasons=routeGuidanceBlockingReasons(outputs);
    expect(reasons.join(' ')).not.toMatch(/route-number-sequence|route-number-switches/);
    expect(supportedRouteGuidance({specialistOutputs:outputs},'route-number-sequence').derivedFrom)
      .toBe('route-relations');
  });
});
