'use strict';

// What a moderator needs in front of her, and in what order. The counts say 23
// are waiting; this says which three cost a click, which two would verify a
// trail, and which ten no decision can clear at all.

const {buildGateEvidence,geometryEvidence,claimEvidence,classifyBlocker,summariseBlockers}=require('./workflows/gate-evidence');
const {routeGuidanceBlockingReasons}=require('./workflows/compile-verified-dossier');

// Taken from the producer, never retyped. The hand-typed copy that stood here
// named route-number-status, which #472 made non-blocking, in a sentence #472
// stopped emitting -- so this asserted that a string nothing produces cannot
// be waived, while the one that is produced could be.
const [ROUTE_GUIDANCE]=routeGuidanceBlockingReasons([]);

const NOW=Date.parse('2026-09-30T00:00:00Z');
const item=(overrides={})=>({
  candidateId:overrides.candidateId||'t1',trailName:'A trail',gateType:'geometry-approval',
  state:'awaiting-human',approvalAllowed:false,openedAt:'2026-09-20T00:00:00Z',
  blockingReasons:[],specialistOutputs:[],...overrides,
});
const build=items=>buildGateEvidence({orchestration:{trails:[]},reviewQueue:{items},nowMs:NOW});

describe('only what is actually waiting',()=>{
  test('an item already decided is not brought back',()=>{
    expect(build([item({state:'processed'}),item({candidateId:'t2'})]).total).toBe(1);
  });

  test('it counts the ones that cost a single click',()=>{
    const report=build([item({approvalAllowed:true}),item({candidateId:'t2'}),item({candidateId:'t3',approvalAllowed:true})]);
    expect(report.readyToApprove).toBe(2);
  });

  // The credit outage put ten of these on the desk. They look like work and
  // are not: the report itself says no decision here clears them.
  test('it says how many no decision can clear',()=>{
    const report=build([item({gateType:'agent-failure'}),item({candidateId:'t2',gateType:'agent-failure'}),item({candidateId:'t3'})]);
    expect(report.notClearableHere).toBe(2);
    expect(report.notClearable).toEqual({agentFailure:2,routeGuidanceMissing:0});
  });

  test('a gate held by route guidance counts too, and is counted separately',()=>{
    // Measured 7 October: three dossier gates arrived carrying four unwaivable
    // route-guidance blockers each and the headline said `0 that no decision
    // here can clear`, so three gates nobody could approve read as available
    // work. The two kinds need opposite things -- a job has to run, or an agent
    // has to supply directions -- so the count distinguishes them.
    const report=build([
      item({candidateId:'needs-directions',gateType:'dossier-approval',blockingReasons:[ROUTE_GUIDANCE]}),
      item({candidateId:'needs-a-job',gateType:'agent-failure'}),
      item({candidateId:'hers',gateType:'dossier-approval',blockingReasons:['terrainPoi/shade: conflicted']}),
    ]);
    expect(report.notClearableHere).toBe(2);
    expect(report.notClearable).toEqual({agentFailure:1,routeGuidanceMissing:1});
    // The one with only waivable blockers is genuinely hers and is not counted.
    expect(report.items.find(entry=>entry.candidateId==='hers').unwaivable).toBe(0);
  });

  test('a stale clean flag does not survive a blocker standing against it',()=>{
    // approvalAllowed is written once when the gate opens; #632 made the
    // blockers beside it recomputed. A stale `true` printed "nothing is
    // blocking this one" directly above the list of what was blocking it.
    const report=build([item({approvalAllowed:true,blockingReasons:['terrainPoi/shade: conflicted']})]);
    expect(report.readyToApprove).toBe(0);
    expect(report.items[0].approvalAllowed).toBe(false);
  });

  test('a genuinely clean gate is still clean',()=>{
    const report=build([item({approvalAllowed:true})]);
    expect(report.readyToApprove).toBe(1);
    expect(report.notClearableHere).toBe(0);
  });
});

describe('ordered by what is worth doing first',()=>{
  test('a dossier approval outranks everything: approving one verifies a trail',()=>{
    const report=build([
      item({candidateId:'fail',gateType:'agent-failure'}),
      item({candidateId:'geo',gateType:'geometry-approval'}),
      item({candidateId:'dossier',gateType:'dossier-approval'}),
    ]);
    expect(report.items.map(entry=>entry.candidateId)).toEqual(['dossier','geo','fail']);
  });

  test('a clean gate comes before a blocked one of the same kind',()=>{
    const report=build([
      item({candidateId:'blocked',blockingReasons:['terrainPoi/livestock: unresolved']}),
      item({candidateId:'clean',approvalAllowed:true}),
    ]);
    expect(report.items.map(entry=>entry.candidateId)).toEqual(['clean','blocked']);
  });

  test('and the longest wait comes first among equals',()=>{
    const report=build([
      item({candidateId:'recent',openedAt:'2026-09-28T00:00:00Z'}),
      item({candidateId:'old',openedAt:'2026-09-01T00:00:00Z'}),
    ]);
    expect(report.items[0].candidateId).toBe('old');
    expect(report.items[0].waitingDays).toBe(29);
  });
});

describe('which blockers a reason can answer',()=>{
  test('route guidance cannot be waived, whatever reason is written',()=>{
    const [entry]=build([item({gateType:'dossier-approval',blockingReasons:[ROUTE_GUIDANCE]})]).items;
    expect(entry.blockers[0].waivable).toBe(false);
    expect(entry.unwaivable).toBe(1);
  });

  test('an ordinary specialist blocker can',()=>{
    const [entry]=build([item({gateType:'dossier-approval',blockingReasons:['terrainPoi/livestock: unresolved']})]).items;
    expect(entry.blockers[0].waivable).toBe(true);
    expect(entry.unwaivable).toBe(0);
  });
});

describe('the evidence the gate is actually asking about',()=>{
  const cartographer=result=>[{agentId:'cartographer',result}];

  test('a geometry gate carries the line against the official figure',()=>{
    const geometry=geometryEvidence(cartographer({
      assessment:{distanceKm:9,isClosed:false,closureDistanceM:6468,maxSegmentM:154,pointCount:771,issues:['not-closed-loop']},
      comparison:{officialDistanceKm:8.9,distanceDeltaPercent:1.1,withinOfficialDistanceTolerance:true},
      source:{externalId:'relation/20347406'},components:[1]}));
    expect(geometry).toEqual(expect.objectContaining({
      distanceKm:9,officialDistanceKm:8.9,isClosed:false,closureDistanceM:6468,externalId:'relation/20347406'}));
  });

  // Dossiers captured before #456 carry no measurement, and reporting that as
  // clean is how an unchecked route reaches a walker.
  test('a dossier with no conformance measurement says so rather than nothing',()=>{
    expect(geometryEvidence(cartographer({assessment:{},comparison:{}})).routeConformance).toBeNull();
  });

  test('and one with a measurement carries it',()=>{
    const geometry=geometryEvidence(cartographer({assessment:{},comparison:{},
      routeConformance:{status:'rejected',offRouteKm:2.72,distanceKm:9.51,maxOffsetM:201}}));
    expect(geometry.routeConformance.status).toBe('rejected');
  });

  test('a dossier gate carries the claims and which are unsupported',()=>{
    const claims=claimEvidence([{agentId:'logistics',result:{claims:[
      {id:'parking',finding:'supported-proposal',sources:[{}]},
      {id:'route-number-status',finding:'unresolved',blockers:['No authority source names the number']}]}}]);
    expect(claims).toHaveLength(2);
    expect(claims.find(claim=>claim.id==='route-number-status')).toEqual(expect.objectContaining({
      agentId:'logistics',finding:'unresolved'}));
  });

  test('a geometry gate does not carry claims, nor a dossier gate a line',()=>{
    const report=build([item({gateType:'dossier-approval'}),item({candidateId:'g',gateType:'geometry-approval'})]);
    expect(report.items[0].geometry).toBeNull();
    expect(report.items[1].claims).toEqual([]);
  });
});

// Forty-one blockers on one dossier is not forty-one problems. Listing them all
// produced a report nobody would read, which is the same as no report.
describe('blockers are counted by shape, not listed',()=>{
  test('each of the four shapes is recognised',()=>{
    // The recommendation travels with the shape, so summariseBlockers no longer
    // re-splits the sentence to get at it.
    expect(classifyBlocker('terrainPoi: recommendation is block'))
      .toEqual({agent:'terrainPoi',kind:'verdict',recommendation:'block'});
    expect(classifyBlocker('terrainPoi: open question — Can a field visit confirm grazing?'))
      .toEqual({agent:'terrainPoi',kind:'open-question'});
    expect(classifyBlocker('terrainPoi/livestock: unresolved'))
      .toEqual({agent:'terrainPoi',kind:'claim-status',claim:'livestock',finding:'unresolved'});
    // A detail carries the claim it is filed under, so blocker-kinds.js can
    // read its standing from that claim rather than from its own prose.
    expect(classifyBlocker('terrainPoi/livestock: No parcel-level record verifies it.'))
      .toEqual({agent:'terrainPoi',kind:'detail',claim:'livestock'});
  });

  test('a blocker naming no agent is still counted, not dropped',()=>{
    expect(classifyBlocker('not-closed-loop').agent).toBe('(unattributed)');
  });

  // The shape of the sitting: mostly open questions means the evidence is thin,
  // several conflicted claims means the sources disagree, and those want
  // different judgements from a moderator.
  test('the summary says what kind of sitting it is',()=>{
    const [terrain]=summariseBlockers([
      {reason:'terrainPoi: recommendation is block',waivable:true},
      {reason:'terrainPoi: open question — one?',waivable:true},
      {reason:'terrainPoi: open question — two?',waivable:true},
      {reason:'terrainPoi/livestock: unresolved',waivable:true},
      {reason:'terrainPoi/livestock: five strategies exhausted',waivable:true},
    ]);
    expect(terrain).toEqual(expect.objectContaining({
      agent:'terrainPoi',total:5,openQuestions:2,verdict:'block',claimStatuses:['livestock unresolved']}));
  });

  test('the noisiest agent is reported first',()=>{
    const summary=summariseBlockers([
      {reason:'evidenceLibrarian/provenance: conflicted',waivable:true},
      {reason:'terrainPoi: open question — a?',waivable:true},
      {reason:'terrainPoi: open question — b?',waivable:true},
    ]);
    expect(summary.map(bucket=>bucket.agent)).toEqual(['terrainPoi','evidenceLibrarian']);
  });

  test('a gate with nothing against it summarises to nothing',()=>{
    expect(summariseBlockers([])).toEqual([]);
  });

  test('every item carries its own summary',()=>{
    const report=buildGateEvidence({orchestration:{trails:[]},nowMs:NOW,reviewQueue:{items:[item({
      gateType:'dossier-approval',
      blockingReasons:['terrainPoi: recommendation is block','terrainPoi/shade: conflicted'],
    })]}});
    expect(report.items[0].blockerSummary[0]).toEqual(expect.objectContaining({agent:'terrainPoi',total:2}));
  });
});

// A geometry gate's blockers are bare codes, not agent prose: short, few, and
// the whole content of the question. Counting those says nothing, so the
// summary keeps them to be named rather than tallied.
describe('bare codes keep their text',()=>{
  test('an unattributed bucket carries the reasons themselves',()=>{
    const [bucket]=summariseBlockers([
      {reason:'not-closed-loop',waivable:true},
      {reason:'official-distance-conflict',waivable:true},
    ]);
    expect(bucket.agent).toBe('(unattributed)');
    expect(bucket.reasons).toEqual(['not-closed-loop','official-distance-conflict']);
  });

  test('an agent bucket carries them too, for the full view',()=>{
    const [bucket]=summariseBlockers([{reason:'terrainPoi/livestock: unresolved',waivable:true}]);
    expect(bucket.reasons).toEqual(['terrainPoi/livestock: unresolved']);
  });
});

// A line is only as current as the relation it was reconstructed from. The
// three gates waiting clean were built from relations last edited in 2022 and
// 2023, long before the dossiers, which is the thing worth knowing before
// approving them -- and it was costing an API call per trail to find out.
describe('which version of the route the line was built from',()=>{
  const cartographer=result=>[{agentId:'cartographer',result}];

  test('comes from the source the cartographer recorded',()=>{
    const geometry=geometryEvidence(cartographer({assessment:{},comparison:{},
      source:{externalId:'relation/14375158',relationVersion:9,relationTimestamp:'2023-10-17T08:00:00Z'}}));
    expect(geometry).toEqual(expect.objectContaining({
      externalId:'relation/14375158',relationVersion:9,relationTimestamp:'2023-10-17T08:00:00Z'}));
  });

  test('falls back to the relation itself when the source did not carry it',()=>{
    const geometry=geometryEvidence(cartographer({assessment:{},comparison:{},
      source:{externalId:'relation/1'},relation:{version:4,timestamp:'2022-07-24T00:00:00Z'}}));
    expect(geometry.relationVersion).toBe(4);
    expect(geometry.relationTimestamp).toBe('2022-07-24T00:00:00Z');
  });

  // Version 0 is not a missing version, and ?? rather than || is what keeps it.
  test('a zero version survives, rather than reading as absent',()=>{
    expect(geometryEvidence(cartographer({assessment:{},comparison:{},
      source:{relationVersion:0}})).relationVersion).toBe(0);
  });

  test('and nothing is guessed when nothing recorded it',()=>{
    const geometry=geometryEvidence(cartographer({assessment:{},comparison:{}}));
    expect(geometry.relationVersion).toBeNull();
    expect(geometry.relationTimestamp).toBeNull();
  });
});
