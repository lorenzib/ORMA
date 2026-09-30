'use strict';

// What a moderator needs in front of her, and in what order. The counts say 23
// are waiting; this says which three cost a click, which two would verify a
// trail, and which ten no decision can clear at all.

const {buildGateEvidence,geometryEvidence,claimEvidence}=require('./workflows/gate-evidence');

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
    const [entry]=build([item({gateType:'dossier-approval',
      blockingReasons:['logistics/route-number-status: supported authoritative route guidance is required']})]).items;
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
