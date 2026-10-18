'use strict';

const {compileVerifiedDossier,establishedRecommendedStart,
  assertRouteGuidance}=require('./workflows/compile-verified-dossier');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');

// The gate approved it and the compiler threw. Five trails stood at the dossier
// gate on 18 October 2026 and not one could produce a dossier, so nothing could
// reach publication -- which is why no trail has ever carried a badge.
//
// Two rules predating the ladder did it. One asked for a recommended start
// citing a published authority, in words written when nothing else could answer
// anything. The other was handed the trail record and did not pass it on, so
// the ladder's bottom rung could not answer in the one place that decides
// whether a dossier exists at all.

const survey=ref=>({
  routeGuidance:ref?singleRelationGuidance({tags:{ref}}):undefined,
  relation:{tags:{name:'Fenn Promenade',...(ref?{ref}:{})}},
  source:{url:'https://www.openstreetmap.org/relation/11839597',externalId:'relation/11839597',
    endpoint:'https://api.openstreetmap.org/api/0.6/relation/11839597/full',
    relationVersion:3,relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
  geometry:{type:'LineString',coordinates:[[11.9,46.8],[11.91,46.81],[11.9,46.8]]},
  assessment:{issues:[],pointCount:3,distanceKm:2}});

const reviewFor=ref=>({reviewId:'r',approvalAllowed:true,blockingReasons:[],
  specialistOutputs:[{agentId:'cartographer',jobId:'c1',result:survey(ref)}]});

const recorded={candidateId:'osm-11839597',trailId:'osm-11839597',trailName:'Fenn Promenade',
  startPoint:{lat:46.8,lng:11.9,label:'Start here: the village car park'}};
const noRecord={candidateId:'osm-11839597',trailId:'osm-11839597',trailName:'Fenn Promenade'};

describe('a dossier exists for a trail the map and the record answered',()=>{
  test('a survey and a start point are enough to compile one',()=>{
    const dossier=compileVerifiedDossier(reviewFor('20'),recorded,
      {at:'2026-10-18T10:00:00Z',trail:recorded});
    expect(dossier.ormaVerification.status).toBe('verified');
    expect(dossier.claims.map(claim=>claim.id)).toEqual(
      expect.arrayContaining(['route-identity','route-geometry']));
    // No specialist spoke, so no safety category may be called reviewed.
    expect(dossier.ormaVerification.researchedCategories).toEqual([]);
  });

  test('a numbered route with no start from any rung is still refused',()=>{
    expect(()=>compileVerifiedDossier(reviewFor('20'),noRecord,{at:'2026-10-18T10:00:00Z'}))
      .toThrow('requires an established recommended-start');
  });

  test('the start may come from any rung, and an authority still wins',()=>{
    expect(establishedRecommendedStart(reviewFor('20'),{trail:recorded}).derivedFrom)
      .toBe('orma-record');
    expect(establishedRecommendedStart(reviewFor('20'),{})).toBeNull();

    const cited={agentId:'logistics',jobId:'log-1',result:{claims:[{id:'recommended-start',
      category:'access',finding:'supported-proposal',proposedValue:'Start at the chapel.',
      sources:[{label:'Commune',url:'https://example.test/x',authority:'Commune'}],blockers:[]}]}};
    const both={...reviewFor('20'),
      specialistOutputs:[...reviewFor('20').specialistOutputs,cited]};
    expect(establishedRecommendedStart(both,{trail:recorded}).claim.proposedValue)
      .toContain('Start at the chapel');
  });

  test('the guidance assertion is given the trail, or the bottom rung is deaf',()=>{
    // Handed in and not passed on was the whole fault: the same review passes
    // with the record and fails without it.
    expect(()=>assertRouteGuidance(reviewFor('20'),recorded)).not.toThrow();
    expect(()=>assertRouteGuidance(reviewFor('20'),noRecord))
      .toThrow('requires sourced route guidance');
  });

  test('a walk with no number needs no number, and still needs a start',()=>{
    // An unnumbered walk skips the numbered-route rule entirely; its directions
    // are still asserted, and its start still has to come from somewhere.
    const unnumbered={...survey(null),routeNumbersAbsent:true};
    const review={reviewId:'r',approvalAllowed:true,blockingReasons:[],
      specialistOutputs:[{agentId:'cartographer',jobId:'c1',result:unnumbered}]};
    expect(()=>compileVerifiedDossier(review,recorded,{at:'2026-10-18T10:00:00Z',trail:recorded}))
      .not.toThrow();
    expect(()=>compileVerifiedDossier(review,noRecord,{at:'2026-10-18T10:00:00Z'})).toThrow();
  });
});
