'use strict';

const {routeGuidanceFromRecord,recordedStart,recordedStatus,ORMA_SUGGESTION,CHECK_ACCESS,ORMA_AUTHORITY}
  =require('./workflows/route-guidance-from-record');
const {supportedRouteGuidance,RECORD_ANSWERABLE_CLAIMS,MAP_ANSWERABLE_CLAIMS,
  ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier');

// 161 of 162 trails carry a named start point with coordinates, so an agent
// asked for `recommended-start` is being paid to rediscover what the catalogue
// has had all along -- and a trail whose search finds no authority is refused
// for want of a fact ORMA could state itself. Measured on the ten trails
// nearest the seal: five were blocked by all four claims at once, every one
// empty because no authority had published anything about that walk.
//
// The public page has rendered exactly this, as a suggestion, for a long time:
// trail-trust says "Suggested start, <place>. Check current access before
// travelling." Only the gate refused it.

const RECORD={id:'osm-9933643',name:'Le Lac Vert',
  startPoint:{label:'loop edge nearest the Plaine-Joux parking',lat:45.93120,lng:6.74210},
  routeRefs:[]};

const cartographer=(over={})=>({agentId:'cartographer',result:{
  relation:{tags:{ref:'3'}},source:{externalId:'relation/9933643'},
  trailRecord:RECORD,...over}});

describe('what ORMA can say about its own record',()=>{
  test('the start it already published, said to be its own suggestion',()=>{
    const claim=routeGuidanceFromRecord(RECORD)['recommended-start'];
    expect(claim.proposedValue).toContain('loop edge nearest the Plaine-Joux parking');
    // The point is pinned on the map beside the words; coordinates are noise.
    expect(claim.proposedValue).not.toContain('45.93120');
    expect(claim.proposedValue).toContain(ORMA_SUGGESTION);
    expect(claim.proposedValue).toContain(CHECK_ACCESS);
    expect(claim.sources[0].authority).toBe(ORMA_AUTHORITY);
    expect(claim.derivedFrom).toBe('orma-record');
  });

  test('the access caveat belongs to the start, not to the numbers',()=>{
    // Access is about whether somebody may begin here today. Attaching it to a
    // sentence about trail numbers warns about the wrong fact.
    const claims=routeGuidanceFromRecord(RECORD,{measuredRefs:['3']});
    expect(claims['recommended-start'].proposedValue).toContain(CHECK_ACCESS);
    expect(claims['route-number-status'].proposedValue).not.toContain(CHECK_ACCESS);
  });

  test('the status reads the numbers, never the provenance code',()=>{
    // routeNumberStatus holds `official-route-page`, `mapped-relation-ref` and
    // the like: where a number came from, not whether the walk has one.
    // Printing it would hand a reader a code.
    const coded={...RECORD,routeNumberStatus:'official-route-page'};
    const value=recordedStatus(coded,['101','105']);
    expect(value).not.toContain('official-route-page');
    expect(value).toContain('101, 105');
    // And it declines to claim what the map cannot establish.
    expect(value).toContain('not confirmed how they appear on local signs');
  });

  test('a walk with no numbers anywhere says to follow the line and the signs',()=>{
    expect(recordedStatus({routeRefs:[]},[]))
      .toContain('Follow the mapped ORMA line and local destination signs');
  });

  test('the measured numbers beat the catalogue’s sparser copy',()=>{
    expect(recordedStatus({routeRefs:['9']},['101','105'])).toContain('101, 105');
    expect(recordedStatus({routeRefs:['9']},[])).toContain('number 9');
  });

  test('a walk with no recorded start gets no start claim',()=>{
    expect(recordedStart({startPoint:{lat:1}})).toBeNull();
    expect(routeGuidanceFromRecord({id:'x'})['recommended-start']).toBeUndefined();
  });

  test('"Start here," is a phrasing of the record, not part of the place',()=>{
    expect(recordedStart({startPoint:{label:'Start here, Lift station',lat:1,lng:2}}).label)
      .toBe('Lift station');
  });
});

describe('the start reads as a sentence for walkers',()=>{
  const start=label=>routeGuidanceFromRecord({id:'x',startPoint:{label,lat:45.19398,lng:6.39891}})['recommended-start'].proposedValue;

  test('a start with no access point found says so plainly, not how ORMA searched',()=>{
    // Live on Circuit des Sallanches on 24 October 2026.
    const value=start('Route start per OpenStreetMap — best parking/access not yet verified');
    expect(value).toBe(`Start where the route begins, marked on the map. No car park or bus stop has been confirmed nearby. ${ORMA_SUGGESTION} ${CHECK_ACCESS}`);
    expect(value).not.toMatch(/OpenStreetMap|45\.19398|not yet verified/);
  });

  test('an access point is named as a walker would say it',()=>{
    expect(start('Start here — Parking, 47 m from the route (OSM-verified access point)'))
      .toBe(`Start at the car park, 47 m from the route, marked on the map. ${ORMA_SUGGESTION} ${CHECK_ACCESS}`);
    expect(start('Start here — Bus stop Kirchplatz, 10 m from the route (OSM-verified access point)'))
      .toMatch(/^Start at the bus stop Kirchplatz, 10 m from the route, marked on the map\./);
  });

  test('a named place keeps its name',()=>{
    expect(start('Karersee car park, Welschnofen (official start)'))
      .toMatch(/^Start at Karersee car park, Welschnofen \(official start\), marked on the map\./);
  });
});

describe('the ladder the gate climbs',()=>{
  const authority=id=>({agentId:'logistics',result:{claims:[{id,finding:'supported-proposal',
    proposedValue:'Start at the Plaine-Joux car park.',
    sources:[{label:'Commune',url:'https://example.test/r',authority:'Commune de Passy'}]}]}});

  test('ORMA answers the two the map cannot, and the numbers for a walk with none',()=>{
    // The first two for any walk. The other two only where the map has been
    // searched for numbers and found none, because then there is no number for
    // anybody to supply and landmarks are the honest answer -- the record
    // refuses them without the audit's measured-and-none mark.
    expect(RECORD_ANSWERABLE_CLAIMS).toEqual(['recommended-start','route-number-status',
      'route-number-sequence','route-number-switches']);
    // Between them the map and the record cover all four, and the two they
    // both answer are the two the map answers better where it can.
    expect([...new Set([...MAP_ANSWERABLE_CLAIMS,...RECORD_ANSWERABLE_CLAIMS])].sort())
      .toEqual([...ROUTE_GUIDANCE_CLAIM_IDS].sort());
    expect(MAP_ANSWERABLE_CLAIMS.every(id=>RECORD_ANSWERABLE_CLAIMS.includes(id))).toBe(true);
  });

  test('all four are answered for a walk no authority has written about',()=>{
    const review={specialistOutputs:[cartographer({
      routeGuidance:{sequence:['3'],switches:[],segments:[]}})]};
    const from=Object.fromEntries(ROUTE_GUIDANCE_CLAIM_IDS
      .map(id=>[id,supportedRouteGuidance(review,id)?.derivedFrom||null]));
    expect(from).toEqual({
      'recommended-start':'orma-record',
      'route-number-status':'orma-record',
      'route-number-sequence':'route-relations',
      'route-number-switches':'route-relations',
    });
  });

  test('an authority beats the record, because it says what somebody recommends',()=>{
    const review={specialistOutputs:[cartographer(),authority('recommended-start')]};
    const answer=supportedRouteGuidance(review,'recommended-start');
    expect(answer.claim.sources[0].authority).toBe('Commune de Passy');
    expect(answer.claim.proposedValue).not.toContain(ORMA_SUGGESTION);
  });

  test('with no record and no authority, nothing is invented',()=>{
    const review={specialistOutputs:[{agentId:'cartographer',result:{
      relation:{tags:{}},source:{externalId:'relation/1'}}}]};
    for(const id of ROUTE_GUIDANCE_CLAIM_IDS){
      expect(supportedRouteGuidance(review,id)).toBeNull();
    }
  });
});
