'use strict';

const {runCartographer}=require('./workflows/run-cartographer');
const {buildCandidate}=require('./workflows/discover-trails');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {routeGuidanceBlockingReasons,supportedRouteGuidance}=require('./workflows/compile-verified-dossier');

// Nineteen of the catalogue's twenty-seven blocked trails carry a route number
// on the very OpenStreetMap relation they are built from -- Fenn Promenade is
// route 20, Anello di Ciampeviei is 69, Dörferrundweg is 4 -- and the gate was
// refusing all of them for want of route guidance.
//
// The number was in their own stored audit the whole time, under
// relation.tags.ref. Only audits taken since 14 October carry the derived
// `routeGuidance` field the gate was reading, and nothing re-audits a trail
// already parked at a gate. citableRelations, ten lines above the reader, had
// always reached into an old audit for that same tag to build the citation --
// so the two halves of one fact disagreed about which audits they could read.

// A loop with three ways, so the audit is a real one rather than a sketch.
const WAYS=[
  {type:'way',id:10,geometry:[{lon:11.58,lat:46.51},{lon:11.59,lat:46.52}]},
  {type:'way',id:11,geometry:[{lon:11.59,lat:46.52},{lon:11.60,lat:46.51}]},
  {type:'way',id:12,geometry:[{lon:11.60,lat:46.51},{lon:11.58,lat:46.51}]},
];

/** A real audit, taken by the real cartographer, for a relation numbered `ref`. */
async function auditFor(ref){
  const candidate=buildCandidate({id:'relation/11839597',name:'Fenn Promenade',
    geometry:[[11.58,46.51],[11.59,46.52],[11.60,46.51],[11.58,46.51]]},{at:'2026-10-15T10:00:00.000Z'});
  candidate.source.externalId='relation/11839597';
  return runCartographer(candidate,{referenceMetrics:{distanceKm:null}},{
    at:'2026-10-15T10:00:00.000Z',
    fetchRelation:async()=>({endpoint:'fixture',payload:{elements:[
      {type:'relation',id:11839597,version:3,timestamp:'2026-09-01T08:00:00Z',
        tags:{type:'route',route:'hiking',name:'Fenn Promenade',...(ref?{ref}:{})},
        members:WAYS.map(way=>({type:'way',ref:way.id}))},
      ...WAYS,
    ]}}),
  });
}

/**
 * The same audit as stored before the derived field existed -- which is what
 * every audit on the shelf looks like. Taken from the producer and stripped,
 * never typed out: a hand-written copy of an output passes against a shape
 * nothing emits.
 */
function asStoredBeforeTheFieldExisted(result){
  const {routeGuidance,...rest}=result;
  expect(routeGuidance).toBeTruthy();
  return rest;
}

const outputsFor=result=>[{agentId:'cartographer',result}];

describe('the map answer in an audit already on the shelf',()=>{
  test('an audit stored before the field existed still answers the two map claims',async()=>{
    const old=asStoredBeforeTheFieldExisted(await auditFor('20'));
    const reasons=routeGuidanceBlockingReasons(outputsFor(old));
    expect(reasons.join(' ')).not.toMatch(/route-number-sequence|route-number-switches/);

    const review={specialistOutputs:outputsFor(old)};
    const sequence=supportedRouteGuidance(review,'route-number-sequence');
    expect(sequence.proposedValue).toContain('route 20');
    // Measured, and saying so in its own words rather than only in the citation.
    expect(sequence.derivedFrom).toBe('route-relations');
    expect(sequence.proposedValue).toContain('Read from the OpenStreetMap route relations');
    expect(supportedRouteGuidance(review,'route-number-switches').proposedValue)
      .toContain('no change of number recorded');
    // Cited to the relation it was read from, not to an authority.
    expect(sequence.sources[0]).toMatchObject({authority:'OpenStreetMap',
      url:'https://www.openstreetmap.org/relation/11839597'});
  });

  test('a fresh audit and an old one reach the same answer',async()=>{
    const fresh=await auditFor('20');
    const old=asStoredBeforeTheFieldExisted(fresh);
    const answerFrom=outputs=>supportedRouteGuidance({specialistOutputs:outputs},'route-number-sequence');
    expect(answerFrom(outputsFor(old)).proposedValue)
      .toBe(answerFrom(outputsFor(fresh)).proposedValue);
    // One derivation, so the writer and the reader cannot drift apart.
    expect(fresh.routeGuidance).toEqual(singleRelationGuidance(fresh.relation));
  });

  test('a walk the map gives no number for is still unanswered, not invented',async()=>{
    // Eight of the blocked trails are genuinely unnumbered -- Boucle du
    // Taillefer, Le Lac Vert, La Croix des Salles. The map must not fill that
    // in, and the gate must still say so.
    const result=await auditFor(null);
    expect(result.routeGuidance).toBeUndefined();
    expect(singleRelationGuidance(result.relation)).toBeNull();
    expect(routeGuidanceBlockingReasons(outputsFor(result)).join(' '))
      .toMatch(/route-number-sequence/);
  });

  test('several numbers joined are the composite path’s to measure, not this one’s',()=>{
    // A composite labels itself with every number it runs along, joined. Those
    // are several routes in an order only a measurement can establish, and the
    // composite writes its own guidance from that measurement.
    expect(singleRelationGuidance({tags:{ref:'101;105'}})).toBeNull();
    expect(singleRelationGuidance({tags:{ref:'101'}})).toEqual({sequence:['101'],switches:[],segments:[]});
    expect(singleRelationGuidance({tags:{}})).toBeNull();
    expect(singleRelationGuidance(null)).toBeNull();
  });
});
