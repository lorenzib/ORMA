const {applyDossierReview}=require('./workflows/apply-dossier-review.js');
const {unacceptedBlockers,waivableBlocker,MIN_ACCEPTANCE_REASON}=require('./workflows/compile-verified-dossier.js');
const {operationalFactsFromClaims}=require('./workflows/compile-operational-facts.js');

// osm-16363583 has three claims at source-exhausted after seven, five and five
// attempts. No further research clears them: the agents have stopped. Either a
// moderator can accept them, or that trail can never be verified.
const EXHAUSTED='terrainPoi/livestock: five automated resolution strategies exhausted';
const OPEN_QUESTION='logistics: open question — is the salle-des-fetes parking usable during the renovation?';
const ROUTE_GUIDANCE='logistics/route-number-sequence: supported authoritative route guidance is required';
const REASON='Walked it in August; the pasture is fenced and the fence is signed.';

describe('which blockers a reason can address', () => {
  test('research loose ends can be accepted', () => {
    [EXHAUSTED,OPEN_QUESTION,'terrainPoi/shade: conflicted'].forEach(reason=>
      expect(waivableBlocker(reason)).toBe(true));
  });

  // Route guidance is printed on the trail page for a walker to follow.
  test('route guidance cannot be, because a reader depends on it', () => {
    expect(waivableBlocker(ROUTE_GUIDANCE)).toBe(false);
  });
});

describe('an acceptance has to mean something', () => {
  const review={blockingReasons:[EXHAUSTED]};

  test('a blocker accepted with a reason stops standing', () => {
    expect(unacceptedBlockers(review,[{blocker:EXHAUSTED,reason:REASON}])).toEqual([]);
  });

  test('a tick with no reason does not count', () => {
    expect(unacceptedBlockers(review,[{blocker:EXHAUSTED,reason:''}])).toEqual([EXHAUSTED]);
    expect(unacceptedBlockers(review,[{blocker:EXHAUSTED,reason:'ok'}])).toEqual([EXHAUSTED]);
    expect('ok'.length).toBeLessThan(MIN_ACCEPTANCE_REASON);
  });

  test('accepting one blocker does not clear another', () => {
    expect(unacceptedBlockers({blockingReasons:[EXHAUSTED,OPEN_QUESTION]},
      [{blocker:EXHAUSTED,reason:REASON}])).toEqual([OPEN_QUESTION]);
  });

  test('accepting route guidance is ignored, not honoured', () => {
    expect(unacceptedBlockers({blockingReasons:[ROUTE_GUIDANCE]},
      [{blocker:ROUTE_GUIDANCE,reason:REASON}])).toEqual([ROUTE_GUIDANCE]);
  });
});

describe('approving a dossier with accepted blockers', () => {
  const at='2026-09-09T12:00:00.000Z';
  // Route guidance is the non-waivable floor, so a dossier that is meant to be
  // approvable must actually carry it. Anything less throws in assertRouteGuidance
  // no matter what the moderator accepted, which is the point.
  const guidanceClaim=id=>({id,category:'route',proposedValue:`Guidance for ${id}`,
    finding:'supported-proposal',confidence:1,rationale:'',blockers:[],
    sources:[{label:'Mairie',url:'https://example.org/route',authority:'municipality',accessedAt:'2026-09-09'}]});
  const LOGISTICS_OUTPUT={agentId:'logistics',jobId:'j1',result:{recommendation:'advance',openQuestions:[],
    claims:['recommended-start','route-number-status','route-number-sequence','route-number-switches'].map(guidanceClaim)}};

  function setup(blockingReasons,specialistOutputs=[LOGISTICS_OUTPUT]){
    const orchestration={contractVersion:'1.0.0',publicMutationAllowed:false,trails:[{
      trailId:'t1',candidateId:'t1',trailName:'Trail',state:'evidence-resolution',stage:'x',
      attempts:{},resolutionAttempts:{},jobIds:[],blockers:[],gate:{id:'dossier-approval'},
      latestOutputRef:null,publicMutationAllowed:false,updatedAt:at}]};
    const reviewQueue={items:[{reviewId:'r1',candidateId:'t1',trailId:'t1',gateType:'dossier-approval',
      state:'awaiting-human',approvalAllowed:false,blockingReasons,specialistOutputs}]};
    return {orchestration,reviewQueue};
  }

  test('it is refused while a blocker is unaddressed', () => {
    const {orchestration,reviewQueue}=setup([EXHAUSTED]);
    expect(()=>applyDossierReview(orchestration,reviewQueue,{reviewId:'r1',action:'approve'},{at}))
      .toThrow(/were not addressed/);
  });

  test('it is refused for missing route guidance however good the reason', () => {
    // No logistics output at all, which is what a missing-guidance trail is.
    const {orchestration,reviewQueue}=setup([ROUTE_GUIDANCE],[]);
    expect(()=>applyDossierReview(orchestration,reviewQueue,
      {reviewId:'r1',action:'approve',acceptedBlockers:[{blocker:ROUTE_GUIDANCE,reason:REASON}]},{at}))
      .toThrow(/Route guidance cannot be accepted, only supplied/);
  });

  test('the moderator, the reason and the moment are kept with the verification', () => {
    const {orchestration,reviewQueue}=setup([EXHAUSTED]);
    const result=applyDossierReview(orchestration,reviewQueue,
      {reviewId:'r1',action:'approve',submittedBy:'moderator-1',
       acceptedBlockers:[{blocker:EXHAUSTED,reason:REASON}]},{at});
    expect(result.verifiedDossier.ormaVerification.acceptedBlockers).toEqual([
      {blocker:EXHAUSTED,reason:REASON,acceptedBy:'moderator-1',acceptedAt:at},
    ]);
    expect(result.orchestration.trails[0].verificationStatus).toBe('orma-verified');
  });

  test('a dossier the agents cleared themselves records no acceptances', () => {
    const {orchestration,reviewQueue}=setup([]);
    reviewQueue.items[0].approvalAllowed=true;
    const result=applyDossierReview(orchestration,reviewQueue,{reviewId:'r1',action:'approve'},{at});
    expect(result.verifiedDossier.ormaVerification.acceptedBlockers).toEqual([]);
  });
});

// The property everything else rests on. Accepting a blocker says the dossier
// can be verified, never that the claim is true.
describe('an accepted blocker does not make a claim true', () => {
  test('an accepted unresolved dog policy still publishes nothing', () => {
    const claim={id:'rifugio-dog-policy',state:'supported',humanAcceptedFinding:'unresolved',
      entityName:'Refuge de Gramusset',rule:'accepted',observedAt:'2026-09-09',verifiedSource:'website'};
    expect(operationalFactsFromClaims([claim],{trailId:'t1'})).toEqual([]);
  });

  test('a genuinely supported one still does', () => {
    const claim={id:'rifugio-dog-policy',state:'supported',humanAcceptedFinding:'supported-proposal',
      entityName:'Refuge de Gramusset',rule:'accepted',observedAt:'2026-09-09',verifiedSource:'website'};
    expect(operationalFactsFromClaims([claim],{trailId:'t1'})).toHaveLength(1);
  });
});
