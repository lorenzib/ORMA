'use strict';

const {compileVerifiedDossier,verificationRecord,officialRouteConfirmation,assertRouteGuidance,
  routeGuidanceBlockingReasons,ROUTE_GUIDANCE_CONTRACT,ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier');

const source=url=>({url,authority:'Comune di Example',label:'Route sheet'});
const claim=(id,extra={})=>({id,category:'logistics',finding:'supported-proposal',proposedValue:`value for ${id}`,
  sources:[source(`https://comune.example/${id}`)],...extra});
const START=claim('recommended-start',{proposedValue:'North car park, by the chapel'});
const ROUTE_NUMBER_CLAIMS=['route-number-status','route-number-sequence','route-number-switches'].map(id=>claim(id));

const cartographer=()=>({agentId:'cartographer',jobId:'j-carto',result:{
  geometry:{type:'LineString',coordinates:[[11.9,46.6],[11.91,46.61]]},
  relation:{tags:{name:'Example Trail'}},
  assessment:{pointCount:2,distanceKm:9.5},
  source:{externalId:'relation/123',endpoint:'https://overpass.example/api',relationVersion:'4',
    relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL',url:'https://osm.example/relation/123',authority:'OpenStreetMap'},
  routeConformance:{status:'conformant',offRouteKm:0,maxDeviationMetres:12},
}});

const review=(logisticsClaims)=>({reviewId:'r-1',approvalAllowed:true,specialistOutputs:[
  cartographer(),
  {agentId:'logistics',jobId:'j-log',result:{recommendation:'advance',openQuestions:[],claims:logisticsClaims}},
]});
const trail={candidateId:'osm-1',trailId:'osm-1',trailName:'Example Trail'};

describe('what ORMA Verified requires',()=>{
  test('a genuinely unnumbered trail can be verified with sourced landmark guidance',()=>{
    const landmarkGuidance=[
      claim('route-number-status',{proposedValue:'This route is landmark-led and has no numbered reference.'}),
      claim('route-number-sequence',{proposedValue:'From the north car park follow the chapel, lake shore and signed return path.'}),
      claim('route-number-switches',{proposedValue:'At the chapel fork keep left for the lake shore; at the south bridge turn onto the return path.'}),
    ];
    const dossier=compileVerifiedDossier(review([START,...landmarkGuidance]),trail,{at:'2026-09-18T00:00:00Z'});
    expect(dossier.ormaVerification.status).toBe('verified');
    expect(dossier.ormaVerification.officialRoute).toEqual({confirmed:true,missingClaims:[]});
  });

  test('a trail that does have one is verified and marked official',()=>{
    const dossier=compileVerifiedDossier(review([START,...ROUTE_NUMBER_CLAIMS]),trail,{at:'2026-09-18T00:00:00Z'});
    expect(dossier.ormaVerification.officialRoute).toEqual({confirmed:true,missingClaims:[]});
    expect(verificationRecord(dossier).officialRouteConfirmed).toBe(true);
  });

  test('the marker reaches the registry, so the public side need not reopen the dossier',()=>{
    expect(verificationRecord(compileVerifiedDossier(review([START,...ROUTE_NUMBER_CLAIMS]),trail)).officialRouteConfirmed).toBe(true);
  });

  test('a walk with no sourced starting point still cannot be verified',()=>{
    // Loosening the gate is not removing it: a walk nobody can find the start
    // of cannot be walked, and this one is usually answerable from a park page.
    expect(()=>compileVerifiedDossier(review([...ROUTE_NUMBER_CLAIMS]),trail))
      .toThrow(/requires sourced route guidance.*recommended-start/);
    expect(()=>assertRouteGuidance(review([]),trail)).toThrow(/recommended-start/);
  });

  test('a recommended start without a named authority does not count',()=>{
    const unsourced=claim('recommended-start',{sources:[{url:'https://blog.example/post'}]});
    expect(()=>compileVerifiedDossier(review([unsourced,...ROUTE_NUMBER_CLAIMS]),trail)).toThrow(/requires sourced route guidance.*recommended-start/);
  });

  test('missing route-following instructions block the gate',()=>{
    expect(routeGuidanceBlockingReasons([{agentId:'logistics',result:{claims:[START]}}]))
      .toEqual(ROUTE_NUMBER_CLAIMS.map(claim=>`logistics/${claim.id}: sourced, reader-usable route guidance is required`));
    expect(routeGuidanceBlockingReasons([{agentId:'logistics',result:{claims:[]}}]))
      .toEqual(['recommended-start',...ROUTE_NUMBER_CLAIMS.map(claim=>claim.id)]
        .map(id=>`logistics/${id}: sourced, reader-usable route guidance is required`));
  });

  test('officialRouteConfirmation names exactly what is missing',()=>{
    expect(officialRouteConfirmation(review([START,claim('route-number-status')])))
      .toEqual({confirmed:false,missingClaims:['route-number-sequence','route-number-switches']});
  });
});

describe('the route-guidance contract',()=>{
  test('the route-guidance contract is unchanged, so nothing is pulled back again',()=>{
    // The hash is derived from what logistics is asked for. All four claims are
    // now also required by the evidence-policy gate.
    expect(ROUTE_GUIDANCE_CONTRACT).toBe('rg-58766aa8');
    expect(ROUTE_GUIDANCE_CLAIM_IDS).toEqual(['recommended-start','route-number-status','route-number-sequence','route-number-switches']);
  });
});
