'use strict';

const {routeGuidanceFromRecord,recordedLandmarks,landmarkRun,
  followedByLandmark,ORMA_SUGGESTION}=require('./workflows/route-guidance-from-record');
const {supportedRouteGuidance,routeGuidanceBlockingReasons,
  RECORD_ANSWERABLE_CLAIMS}=require('./workflows/compile-verified-dossier');

// Some walks carry no route number, and no numbered route runs along them
// either. Boucle du Taillefer and Boucle du Lac Vert were measured against the
// live map on 15 October 2026 and have nothing. Asking them "what order are the
// numbers in" has no answer, and refusing them for want of one refuses them for
// ever.
//
// What they do have is landmarks ORMA wrote down by hand, with a kilometre mark
// and a sentence: Taillefer's high point at 3.6 km with its benches and double
// panorama over the two lakes. That is what somebody walking it actually
// follows. Two of the seven have nothing but a start, and those are told to
// follow the name on the signs and the line on the page.

// Boucle du Taillefer's own record, copied in shape from data/regions.
const TAILLEFER={id:'osm-14864704',name:'Boucle du Taillefer',
  startPoint:{lat:45.8271246,lng:6.2025044,
    label:"Start here: parking de l'église, Duingt (overflow parking on route des Prés Bernard)"},
  decisionPoints:[{km:3.6,lat:45.80857,lng:6.19706,
    instruction:'Taillefer high point (766 m): benches and the double panorama over the Grand and Petit lac d’Annecy'}],
  rifugi:[{km:5.1,name:'Buvette du Roselet'}],
  waterSources:[{km:0,label:'Drinking water (OSM-verified location)'},
    {km:2.2,label:'Drinking water (OSM-verified location)'}]};

// Itinéraire de découverte historique: a start and nothing else.
const BARE={id:'osm-10116283',name:'Itinéraire de découverte historique',
  startPoint:{lat:46.0,lng:6.4,label:'Start here: the village church square'},
  decisionPoints:[],rifugi:[],waterSources:[]};

/** A cartographer audit that looked for numbers and found none. */
const measuredNone=()=>({agentId:'cartographer',result:{routeNumbersAbsent:true,
  relation:{tags:{name:'Boucle du Taillefer'}},source:{externalId:'relation/14864704'}}});
/** An audit from before that measurement existed: it cannot say either way. */
const neverMeasured=()=>({agentId:'cartographer',result:{
  relation:{tags:{name:'Boucle du Taillefer'}},source:{externalId:'relation/14864704'}}});

describe('a walk with no number says how to follow it',()=>{
  test('the landmarks come in the order a walker meets them',()=>{
    // A decision point is "place: what is there". The place is the landmark;
    // the rest belongs on the trail page.
    expect(recordedLandmarks(TAILLEFER))
      .toEqual([{km:3.6,name:'Taillefer high point (766 m)'},
        {km:5.1,name:'Buvette du Roselet'}]);
    // Water is left out: five copies of "Drinking water (OSM-verified
    // location)" is not a thing to navigate by.
    expect(recordedLandmarks(TAILLEFER).some(l=>/OSM-verified/.test(l.name))).toBe(false);
  });

  test('it names them with their distance, and reads as an order',()=>{
    expect(landmarkRun([{km:3.6,name:'A'},{km:5.1,name:'B'},{km:6,name:'C'}]))
      .toBe('A at 3.6 km; then B at 5.1 km; then C at 6 km');
    // One landmark has no order to be in.
    expect(landmarkRun([{km:3.6,name:'A'}])).toBe('A at 3.6 km');
    expect(landmarkRun([])).toBeNull();
  });

  test('the walker is told there is no number, then where to go',()=>{
    expect(followedByLandmark(TAILLEFER,'route-number-sequence')).toBe(
      'This walk carries no route number and no numbered route runs along it.'
      +" It is followed by name and by landmark: from parking de l'église, Duingt"
      +' (overflow parking on route des Prés Bernard), the route passes'
      +' Taillefer high point (766 m) at 3.6 km; then Buvette du Roselet at 5.1 km.');
    // "Start here" is how the record phrases it, not part of the place's name.
    expect(followedByLandmark(TAILLEFER,'route-number-sequence')).not.toContain('Start here');
  });

  test('no number means no change of number, said plainly',()=>{
    const switches=followedByLandmark(TAILLEFER,'route-number-switches');
    expect(switches).toContain('carries no route number, so no number changes along it');
    expect(switches).toContain('Buvette du Roselet');
  });

  test('a walk with no landmarks is told to follow the line on the page',()=>{
    for(const id of ['route-number-sequence','route-number-switches']){
      const value=followedByLandmark(BARE,id);
      expect(value).toContain('no landmark sequence recorded');
      expect(value).toContain('follow the walk’s name on local signs and the mapped ORMA line');
      // And it does not also claim the walk is followed by landmark, which
      // would be two sentences arguing with each other.
      expect(value).not.toContain('followed by name and by landmark');
      // Never invented: no distances, no places.
      expect(value).not.toMatch(/\d+(\.\d+)? km/);
    }
  });

  test('every value says whose suggestion it is',()=>{
    const claims=routeGuidanceFromRecord(TAILLEFER,{routeNumbersAbsent:true,at:'2026-10-15T12:00:00Z'});
    for(const id of ['route-number-sequence','route-number-switches']){
      expect(claims[id].proposedValue).toContain(ORMA_SUGGESTION);
      expect(claims[id].derivedFrom).toBe('orma-record');
      expect(claims[id].sources[0].authority).toBe('ORMA');
    }
  });

  test('a walk nobody has measured is never told it has no number',()=>{
    // Measured-and-none is a fact about the walk; never-measured is a fact
    // about ORMA. Audits taken before the measurement existed carry no mark,
    // and claiming from them is the trap #806 fell into.
    const claims=routeGuidanceFromRecord(TAILLEFER,{at:'2026-10-15T12:00:00Z'});
    expect(claims['route-number-sequence']).toBeUndefined();
    expect(claims['route-number-switches']).toBeUndefined();
    // It still answers the two it always could.
    expect(claims['recommended-start']).toBeTruthy();
    expect(claims['route-number-status']).toBeTruthy();
  });

  test('the gate accepts it, and refuses the walk that was never measured',()=>{
    const answered=[measuredNone()];
    expect(routeGuidanceBlockingReasons(answered,{trail:TAILLEFER}).join(' '))
      .not.toMatch(/route-number-sequence|route-number-switches/);
    expect(supportedRouteGuidance({specialistOutputs:answered},'route-number-sequence',
      {trail:TAILLEFER}).derivedFrom).toBe('orma-record');

    const unmeasured=[neverMeasured()];
    expect(routeGuidanceBlockingReasons(unmeasured,{trail:TAILLEFER}).join(' '))
      .toMatch(/route-number-sequence/);
  });

  test("the map still wins where it has numbers",()=>{
    // The record is the bottom rung. A measured number is better evidence than
    // a landmark, and the ladder must not prefer the weaker answer.
    // Shaped as the along-the-walk measurement stores it: the numbers come from
    // other routes, so those are what the claim cites.
    const numbered=[{agentId:'cartographer',result:{
      routeGuidance:{alongOtherRoutes:true,sequence:['9','56'],
        switches:[{from:'9',to:'56',km:2.1}],segments:[],
        relations:[{externalRelationId:'relation/1',ref:'9',name:'Route 9'},
          {externalRelationId:'relation/2',ref:'56',name:'Route 56'}]},
      relation:{tags:{ref:null,name:'La Croix des Salles'}},
      source:{externalId:'relation/11517208'}}}];
    expect(supportedRouteGuidance({specialistOutputs:numbered},'route-number-sequence',
      {trail:TAILLEFER}).derivedFrom).toBe('route-relations');
    expect(RECORD_ANSWERABLE_CLAIMS).toContain('route-number-sequence');
  });
});
