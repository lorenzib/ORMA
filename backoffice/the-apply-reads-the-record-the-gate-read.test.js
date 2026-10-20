'use strict';

const {applyDossierReview}=require('./workflows/apply-dossier-review');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');

// Five trails stood approved at the dossier gate on 20 October and every one
// was refused by the compiler:
//
//   action: approve -> status: blocked
//   "Fenn Promenade requires sourced route guidance before verification:
//    recommended-start"
//
// The fast lane opens that gate on ORMA's own recorded walk -- it reads the
// catalogue to do it. The compiler was then handed the *orchestration* entry,
// whose fields are state, blockers, jobIds and attempts. recordedStart looks
// for trail.startPoint, found none, the record could answer nothing, and a
// walk whose start ORMA has always published was refused for lacking one.
//
// Two different objects for the same trail, and the two ends of the decision
// were reading different ones. a-dossier-exists-for-a-fast-lane-trail covers
// the compiler and passes the catalogue record in as the trail, so it could
// not see this: the gap is the wiring, which is what this exercises.

const AT='2026-10-20T10:00:00.000Z';

/** The recorded walk, as run-catalogue-batch stamps it onto the survey. */
const recordedWalk={id:'osm-11839597',name:'Fenn Promenade',
  startPoint:{lat:46.8,lng:11.9,label:'Start here: the village car park'}};

/** What the cartographer leaves behind, and all the fast lane has. */
const survey=(withRecord=true)=>({
  ...(withRecord?{trailRecord:recordedWalk}:{}),
  routeGuidance:singleRelationGuidance({tags:{ref:'20'}}),
  relation:{tags:{name:'Fenn Promenade',ref:'20'}},
  source:{url:'https://www.openstreetmap.org/relation/11839597',externalId:'relation/11839597',
    endpoint:'https://api.openstreetmap.org/api/0.6/relation/11839597/full',
    relationVersion:3,relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
  geometry:{type:'LineString',coordinates:[[11.9,46.8],[11.91,46.81],[11.9,46.8]]},
  assessment:{issues:[],pointCount:3,distanceKm:2}});

/** The orchestration entry: no startPoint, because it never had one. */
const orchestration=()=>({contractVersion:'1.0.0',generatedAt:AT,publicMutationAllowed:false,summary:{},
  trails:[{trailId:'osm-11839597',candidateId:'osm-11839597',trailName:'Fenn Promenade',
    state:'dossier-human-gate',stage:'complete-evidence-dossier',
    attempts:{cartographer:8},resolutionAttempts:{},jobIds:['c1'],currentJobId:'c1',
    gate:{id:'dossier-approval',status:'awaiting-human'},blockers:[],publicMutationAllowed:false}]});

const reviewQueue=(withRecord=true)=>({contractVersion:'1.0.0',items:[{reviewId:'review-a',candidateId:'osm-11839597',
  trailId:'osm-11839597',trailName:'Fenn Promenade',gateType:'dossier-approval',state:'awaiting-human',
  approvalAllowed:true,blockingReasons:[],
  specialistOutputs:[{agentId:'cartographer',jobId:'c1',result:survey(withRecord)}]}]});

const approve={reviewId:'review-a',action:'approve',submittedBy:'orma-existing-trail-verifier-v1'};

describe('the apply step judges on the record the gate judged on',()=>{
  test('a walk whose start ORMA publishes compiles a dossier',()=>{
    const result=applyDossierReview(orchestration(),reviewQueue(),approve,{at:AT});

    expect(result.verifiedDossier).toBeTruthy();
    expect(result.orchestration.trails[0].state).toBe('ready-for-editorial');
    expect(result.orchestration.trails[0].verificationStatus).toBe('orma-verified');
    // The start that answered is ORMA's own, and the claim id says so rather
    // than passing itself off as an operator's recommendation.
    const ids=result.verifiedDossier.claims.map(claim=>claim.id);
    expect(ids).toContain('orma-recommended-start');
    expect(ids).not.toContain('recommended-start');
    const start=result.verifiedDossier.claims.find(claim=>claim.id==='orma-recommended-start');
    expect(start.proposedValue).toContain('the village car park');
  });

  test('a survey carrying no recorded walk is still refused',()=>{
    // The fix must not invent a start: with nothing stamped and no authority
    // cited, there is genuinely nothing to answer with.
    expect(()=>applyDossierReview(orchestration(),reviewQueue(false),approve,{at:AT}))
      .toThrow(/recommended-start/);
  });
});
