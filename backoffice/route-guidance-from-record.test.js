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

describe('directions approved in the old wording are published in the new one',()=>{
  const {inCurrentWording,LEGACY_ORMA_SUGGESTION,startSentence}=require('./workflows/route-guidance-from-record');
  const {materializeApprovedPublications}=require('./workflows/materialize-approved-publications');
  // Geotrail Bulla as it went live on 25 October 2026.
  const startPoint={lat:46.5802,lng:11.6228,label:'Panider Sattel / Passo Pinei, Pas Pinëi bus stop (line 172), by Hotel Pinei Nature & Spirit'};
  const bulla={mode:'numbered',
    start:`Start at ${startPoint.label} (46.58020, 11.62280). ${LEGACY_ORMA_SUGGESTION} ${CHECK_ACCESS}`,
    status:`The mapped route carries trail numbers 3A, 24; look for them at junctions. ORMA has not confirmed how they appear on local signs. ${LEGACY_ORMA_SUGGESTION}`,
    sequence:'The mapped route runs along waymarked routes 3A, 24 and then 3A, in that order from the start.',
    switches:'Waymarked route 3A gives way to waymarked route 24 about 2.9 km from the start.',
    establishedBy:{start:'orma-record',status:'orma-record',sequence:'route-relations',switches:'route-relations'}};

  test('ORMA’s own start is rebuilt as a sentence, and the old suggestion line is replaced everywhere',()=>{
    const next=inCurrentWording(bulla,startPoint);
    expect(next.start).toBe(`Start at Panider Sattel / Passo Pinei, Pas Pinëi bus stop (line 172), by Hotel Pinei Nature & Spirit, marked on the map. ${ORMA_SUGGESTION} ${CHECK_ACCESS}`);
    expect(next.status).toContain(ORMA_SUGGESTION);
    expect(JSON.stringify(next)).not.toContain(LEGACY_ORMA_SUGGESTION);
    expect(next.start).not.toMatch(/46\.58020/);
    // What the map answered is left as it was.
    expect(next.sequence).toBe(bulla.sequence);
    expect(next.establishedBy).toEqual(bulla.establishedBy);
  });

  test('a start an operator or an agent answered is never rewritten',()=>{
    const official={...bulla,start:'Start at the Seiser Alm gondola (official start).',establishedBy:{...bulla.establishedBy,start:'agent-evidence'}};
    expect(inCurrentWording(official,startPoint).start).toBe(official.start);
  });

  test('the publisher writes the new wording even from a dossier approved in the old one',()=>{
    const path=[[46.58,11.62],[46.59,11.63],[46.58,11.62]];
    const result=materializeApprovedPublications({
      requests:{requests:[{id:'pub-1',candidateId:'geotrail-bulla',status:'approved-for-pr-creation'}]},
      staging:{items:[{candidateId:'geotrail-bulla',targetTrailId:'geotrail-bulla',state:'ready-for-publication-preview',
        proposedWebsiteFields:{name:'Geotrail Bulla',distance:2.6,startPoint,routeNumberGuidance:bulla,ormaVerified:false}}]},
      routesByCandidate:{'geotrail-bulla':{geometry:{type:'LineString',coordinates:path.map(([lat,lng])=>[lng,lat])}}},
      overrides:{contractVersion:'1.0.0',trails:[]},operationalFacts:{trails:[]},at:'2026-10-26T15:00:00Z'});
    const guidance=result.overrides.trails[0].fields.routeNumberGuidance;
    expect(guidance.start).toBe(startSentence({label:startPoint.label,lat:startPoint.lat,lng:startPoint.lng}));
    expect(JSON.stringify(guidance)).not.toContain(LEGACY_ORMA_SUGGESTION);
    // The map's answer keeps its numbers and distances, in today's words.
    expect(guidance.sequence).toBe('The mapped route runs along numbered trails 3A, 24 and then 3A, in that order from the start.');
    expect(guidance.switches).toBe('Trail 3A gives way to trail 24 about 2.9 km from the start.');
  });

  test('a map answer approved in the old wording gets the plain source line and no "waymarked"',()=>{
    const {mapInCurrentWording,READ_FROM_MAP,LEGACY_READ_FROM_MAP}=require('./workflows/route-guidance-from-map');
    const old={...bulla,
      sequence:`This walk carries no route number of its own. The mapped route runs along waymarked routes 7, 7A, 16 and then 15A, in that order from the start. ${LEGACY_READ_FROM_MAP}`,
      switches:`The mapped route runs along waymarked route 9 throughout, with no change of waymark recorded along it. ${LEGACY_READ_FROM_MAP}`};
    const next=mapInCurrentWording(old);
    expect(next.sequence).toBe(`This walk carries no route number of its own. The mapped route runs along numbered trails 7, 7A, 16 and then 15A, in that order from the start. ${READ_FROM_MAP}`);
    expect(next.switches).toBe(`The mapped route runs along numbered trail 9 throughout, with no change of number recorded along it. ${READ_FROM_MAP}`);
    expect(next.start).toBe(old.start);
    expect(next.establishedBy).toEqual(old.establishedBy);
  });
});
