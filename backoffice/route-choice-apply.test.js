'use strict';

const fs=require('fs');
const {createHash}=require('crypto');
const {applyRouteReview,APPROVAL_SCOPE}=require('./workflows/apply-route-review');
const {ingestRouteReviews}=require('./workflows/run-live-backoffice-worker');
const {routeProposals}=require('./cli/seed-live-state');

// Stage 0 could be answered and never applied: `submitRouteReview` wrote a
// queued document and no workflow read that collection, so the question stayed
// open for ever and the chosen line never became the candidate's route.

const AT='2026-10-02T13:38:18.000Z';
const QUESTIONS=JSON.parse(fs.readFileSync('backoffice-data/route-review.json','utf8'));
const TRE_CIME='osm-relation-1484751';
const TRE_CIME_TRAIL='tre-cime';
const CLASSIC='tre-cime-classic-101-105';
const PATERNO='tre-cime-monte-paterno-101-104-105';

function questions(){return JSON.parse(JSON.stringify(QUESTIONS));}
function itemOf(artifact,candidateId){return artifact.items.find(item=>item.candidateId===candidateId);}
function feature(proposalId){
  const proposal=routeProposals(QUESTIONS).find(candidate=>candidate.id===proposalId);
  return JSON.parse(fs.readFileSync(proposal.geometryRef,'utf8'));
}
function decision(overrides={}){
  return {id:'route-review-1',candidateId:TRE_CIME,action:'approve-route',proposalIds:[CLASSIC],
    note:'',status:'queued',submittedAt:AT,submittedBy:'moderator-uid',...overrides};
}

describe('a kept route becomes the candidate line', () => {
  test('the question closes, the choice is recorded, and the chosen line is promoted',()=>{
    const result=applyRouteReview(questions(),null,decision(),{at:AT,geometries:new Map([[CLASSIC,feature(CLASSIC)]])});
    const item=itemOf(result.routeReview,TRE_CIME);
    expect(item.reviewState).toBe('route-choice-approved');
    expect(item.selectedProposalId).toBe(CLASSIC);
    expect(item.decision).toEqual(expect.objectContaining({action:'approve-route',reviewedBy:'moderator-uid',reviewedAt:AT}));
    // Promoted under the catalogue trail the question names, which is the id
    // publication reads a route from — not the OSM object it was asked about.
    expect(result.promotions).toEqual([expect.objectContaining({candidateId:TRE_CIME_TRAIL,proposalId:CLASSIC,
      coordinateCount:2077})]);
    expect(result.ledger.decisions[0].promotedAs).toBe(TRE_CIME_TRAIL);
    expect(result.promotions[0].feature.properties.proposalId).toBe(CLASSIC);
    expect(result.outcome.promoted).toEqual([CLASSIC]);
  });

  test('the receipt proves which line was kept, and says what it does not clear',()=>{
    const result=applyRouteReview(questions(),null,decision(),{at:AT,geometries:new Map([[CLASSIC,feature(CLASSIC)]])});
    const entry=result.ledger.decisions[0];
    expect(entry).toEqual(expect.objectContaining({candidateId:TRE_CIME,proposalId:CLASSIC,gate:'geometry-approval',
      coordinateCount:2077,reviewedBy:'moderator-uid',scope:APPROVAL_SCOPE}));
    expect(entry.geometrySha256).toBe(createHash('sha256').update(JSON.stringify(feature(CLASSIC).geometry)).digest('hex'));
    expect(result.ledger.publicMutationAllowed).toBe(false);
  });

  test('every variant kept is named, and only the first becomes this candidate',()=>{
    // "They must remain separate ORMA route variants" is what the card says. A
    // second variant needs its own candidate, so the apply step records the debt
    // rather than dropping the variant or inventing a trail.
    const result=applyRouteReview(questions(),null,
      decision({action:'approve-route-variants',proposalIds:[PATERNO,CLASSIC]}),
      {at:AT,geometries:new Map([[CLASSIC,feature(CLASSIC)],[PATERNO,feature(PATERNO)]])});
    const item=itemOf(result.routeReview,TRE_CIME);
    expect(item.selectedProposalIds).toEqual([CLASSIC,PATERNO]);
    expect(item.pendingVariantIntake).toEqual([expect.objectContaining({proposalId:PATERNO})]);
    expect(item.nextAgentAction.action).toBe('admit-kept-variants-as-candidates');
    expect(result.promotions.map(promotion=>promotion.proposalId)).toEqual([CLASSIC]);
    expect(result.ledger.decisions[0].keptVariantIds).toEqual([PATERNO]);
  });

  test('a decision is never lost to a line that cannot be read',()=>{
    const result=applyRouteReview(questions(),null,decision(),{at:AT,geometries:new Map()});
    expect(itemOf(result.routeReview,TRE_CIME).reviewState).toBe('route-choice-approved');
    expect(result.outcome.unresolvedGeometry).toEqual([CLASSIC]);
    expect(result.ledger.decisions[0].geometry).toBe('unresolved');
  });

  test('a question naming no catalogue trail keeps the line under its own id',()=>{
    // Nothing is written under a name that means another trail; the line is
    // still stored, so the choice is not lost.
    const artifact=questions();
    delete itemOf(artifact,TRE_CIME).trailId;
    const result=applyRouteReview(artifact,null,decision(),{at:AT,geometries:new Map([[CLASSIC,feature(CLASSIC)]])});
    expect(result.promotions[0].candidateId).toBe(TRE_CIME);
  });

  test('a line that says it is another proposal is refused, not published under this trail',()=>{
    const wrong=feature(PATERNO);
    const result=applyRouteReview(questions(),null,decision(),{at:AT,geometries:new Map([[CLASSIC,wrong]])});
    expect(result.promotions[0].feature).toBeNull();
    expect(result.ledger.decisions[0]).toEqual(expect.objectContaining({geometry:'rejected-proposal-mismatch',
      foundProposalId:PATERNO}));
  });
});

describe('a choice that cannot be applied says so', () => {
  test('an unknown proposal is refused',()=>{
    expect(()=>applyRouteReview(questions(),null,decision({proposalIds:['invented-route']}),{at:AT}))
      .toThrow('Route proposal is not on this review');
  });

  test('a single-route question cannot keep two',()=>{
    expect(()=>applyRouteReview(questions(),null,
      decision({candidateId:'osm-way-25736154',action:'approve-route-variants',
        proposalIds:['lago-braies-seeweg-circuit','lago-braies-seeweg-circuit']}),{at:AT}))
      .toThrow('Only one route may be kept');
  });

  test('the action and the number of routes kept have to agree',()=>{
    expect(()=>applyRouteReview(questions(),null,decision({proposalIds:[CLASSIC,PATERNO]}),{at:AT}))
      .toThrow('approve-route-variants');
  });

  test('a route its own findings hold cannot be approved into the catalogue',()=>{
    // Monte Pelmo: five attempts did not resolve the access conflict.
    expect(()=>applyRouteReview(questions(),null,
      decision({candidateId:'osm-relation-1372055',proposalIds:['anything']}),{at:AT}))
      .toThrow('cannot be approved while its own findings stand');
  });

  test('a question already decided is not decided twice',()=>{
    const once=applyRouteReview(questions(),null,decision(),{at:AT,geometries:new Map([[CLASSIC,feature(CLASSIC)]])});
    expect(()=>applyRouteReview(once.routeReview,once.ledger,decision({id:'route-review-2'}),{at:AT}))
      .toThrow('no longer awaiting a decision');
  });

  test('sending a route back for research needs the instruction it will carry',()=>{
    expect(()=>applyRouteReview(questions(),null,decision({action:'request-route-research',note:'  '}),{at:AT}))
      .toThrow('A precise research instruction is required');
  });
});

describe('the answers that are not approvals', () => {
  test('more research hands the question back with the editor\'s words and spends an attempt',()=>{
    const result=applyRouteReview(questions(),null,
      decision({action:'request-route-research',note:'Find the comune route sheet for 104.'}),{at:AT});
    const item=itemOf(result.routeReview,TRE_CIME);
    expect(item.reviewState).toBe('route-research-requested');
    expect(item.nextAgentAction).toEqual(expect.objectContaining({action:'research-route-proposals',
      attempt:2,instructions:'Find the comune route sheet for 104.'}));
  });

  test('past the retry budget, the next step is a person rather than a sixth run',()=>{
    const artifact=questions();
    itemOf(artifact,TRE_CIME).nextAgentAction={action:'await-human-route-choice',attempt:5,completedAttempts:5,maximumAttempts:5};
    const result=applyRouteReview(artifact,null,
      decision({action:'request-route-research',note:'Try once more.'}),{at:AT});
    const item=itemOf(result.routeReview,TRE_CIME);
    expect(item.reviewState).toBe('source-exhausted-direct-confirmation');
    expect(item.approvalAllowed).toBe(false);
    expect(item.nextAgentAction.action).toBe('await-direct-confirmation-or-field-check');
  });

  test('a rejected source closes the question and keeps why',()=>{
    const result=applyRouteReview(questions(),null,
      decision({action:'reject-route-source',note:'The GPX is a ferrata variant.'}),{at:AT});
    const item=itemOf(result.routeReview,TRE_CIME);
    expect(item.reviewState).toBe('route-source-rejected');
    expect(item.approvalAllowed).toBe(false);
    expect(result.ledger.decisions[0].note).toBe('The GPX is a ferrata variant.');
  });
});

describe('the worker applies what the desk recorded', () => {
  function store(reviews,artifacts){
    const marks=[];
    return {marks,artifacts,
      listRouteReviews:async status=>reviews.filter(review=>review.status===status),
      getArtifact:async id=>artifacts[id]??null,
      setArtifact:async(id,value)=>{artifacts[id]=value;},
      markRouteReview:async(id,status,fields)=>marks.push({id,status,fields})};
  }

  test('a queued choice is applied, promoted and marked processed',async()=>{
    const artifacts={'route-review':questions(),[`route-proposal-geometry-${CLASSIC}`]:feature(CLASSIC)};
    const target=store([decision()],artifacts);
    const outcomes=await ingestRouteReviews(target);
    expect(outcomes).toEqual([expect.objectContaining({reviewId:'route-review-1',status:'processed',promoted:[CLASSIC]})]);
    expect(itemOf(artifacts['route-review'],TRE_CIME).reviewState).toBe('route-choice-approved');
    expect(artifacts[`route-proposal-${TRE_CIME_TRAIL}`].properties.proposalId).toBe(CLASSIC);
    expect(artifacts['route-review-ledger'].decisions).toHaveLength(1);
    expect(target.marks).toEqual([expect.objectContaining({id:'route-review-1',status:'processed'})]);
  });

  test('a change of mind is applied once, and the earlier answer is superseded, not failed',async()=>{
    const artifacts={'route-review':questions(),[`route-proposal-geometry-${CLASSIC}`]:feature(CLASSIC),
      [`route-proposal-geometry-${PATERNO}`]:feature(PATERNO)};
    const target=store([
      decision({id:'first',proposalIds:[PATERNO],submittedAt:'2026-10-02T13:30:00.000Z'}),
      decision({id:'second',proposalIds:[CLASSIC],submittedAt:'2026-10-02T13:38:18.000Z'}),
    ],artifacts);
    const outcomes=await ingestRouteReviews(target);
    expect(outcomes).toEqual([
      expect.objectContaining({reviewId:'first',status:'superseded',supersededBy:'second'}),
      expect.objectContaining({reviewId:'second',status:'processed',promoted:[CLASSIC]}),
    ]);
    expect(itemOf(artifacts['route-review'],TRE_CIME).selectedProposalId).toBe(CLASSIC);
  });

  test('a choice that cannot be applied is blocked with the reason, and nothing is written',async()=>{
    const artifacts={'route-review':questions()};
    const target=store([decision({proposalIds:['invented-route']})],artifacts);
    const outcomes=await ingestRouteReviews(target);
    expect(outcomes).toEqual([expect.objectContaining({status:'blocked',error:expect.stringContaining('not on this review')})]);
    expect(itemOf(artifacts['route-review'],TRE_CIME).reviewState).toBe('ready-for-human-route-choice');
    expect(artifacts[`route-proposal-${TRE_CIME_TRAIL}`]).toBeUndefined();
    expect(target.marks).toEqual([expect.objectContaining({status:'blocked'})]);
  });

  test('a store too old to list route decisions is not an error',async()=>{
    expect(await ingestRouteReviews({})).toEqual([]);
  });
});
