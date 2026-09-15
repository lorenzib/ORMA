'use strict';

const {ROUTE_GUIDANCE_CONTRACT,ROUTE_GUIDANCE_CLAIM_IDS,routeGuidanceContractOf,
  routeGuidanceContractStale}=require('./workflows/compile-verified-dossier');
const {claimContractStamp,runTrailSpecialist}=require('./workflows/run-trail-specialist');
const {advanceTrailOrchestration}=require('./workflows/advance-trail-orchestration');

const AT='2026-09-15T09:00:00.000Z';
const SOURCE=[{url:'https://example.org/route',authority:'Comune di Ortisei'}];
const supported=id=>({id,finding:'supported-proposal',proposedValue:'stated',sources:SOURCE});
const fullClaims=()=>ROUTE_GUIDANCE_CLAIM_IDS.map(supported);

function logisticsOutput(extra={}){
  return {agentId:'logistics',jobId:'job-log',
    result:{agentId:'logistics',recommendation:'advance',openQuestions:[],claims:fullClaims(),...extra}};
}

describe('the claim contract a dossier was captured under',()=>{
  test('names exactly the claims the gate requires',()=>{
    expect([...ROUTE_GUIDANCE_CLAIM_IDS].sort()).toEqual(
      ['recommended-start','route-number-sequence','route-number-status','route-number-switches']);
    expect(ROUTE_GUIDANCE_CONTRACT).toMatch(/^rg-[0-9a-f]{8}$/);
  });

  // The version exists to be compared, so the one property that matters is that
  // it is a function of the requirement and nothing else.
  test('is derived from the required set, not declared by hand',()=>{
    const {createHash}=require('crypto');
    const expected=`rg-${createHash('sha256')
      .update([...ROUTE_GUIDANCE_CLAIM_IDS].sort().join(',')).digest('hex').slice(0,8)}`;
    expect(ROUTE_GUIDANCE_CONTRACT).toBe(expected);
    // Reordering the list is not a change of requirement.
    const reordered=`rg-${createHash('sha256')
      .update([...ROUTE_GUIDANCE_CLAIM_IDS].reverse().sort().join(',')).digest('hex').slice(0,8)}`;
    expect(reordered).toBe(ROUTE_GUIDANCE_CONTRACT);
  });

  test('an output from before the requirement reads as stale',()=>{
    expect(routeGuidanceContractStale([logisticsOutput()])).toBe(true);
    expect(routeGuidanceContractOf([logisticsOutput()])).toBeNull();
  });

  test('an output stamped with the current contract does not',()=>{
    const fresh=[logisticsOutput({claimContracts:{routeGuidance:ROUTE_GUIDANCE_CONTRACT}})];
    expect(routeGuidanceContractStale(fresh)).toBe(false);
    expect(routeGuidanceContractOf(fresh)).toBe(ROUTE_GUIDANCE_CONTRACT);
  });

  test('a superseded stamp reads as stale',()=>{
    expect(routeGuidanceContractStale([logisticsOutput({claimContracts:{routeGuidance:'rg-deadbeef'}})])).toBe(true);
  });

  // A trail that has not reached logistics yet is unfinished, not stale; calling
  // it stale would re-queue an agent that has never run.
  test('a dossier with no logistics output yet is not stale',()=>{
    expect(routeGuidanceContractStale([{agentId:'terrainPoi',result:{claims:[]}}])).toBe(false);
    expect(routeGuidanceContractStale([])).toBe(false);
  });

  test('only the agent that carries the claims is stamped',()=>{
    expect(claimContractStamp('logistics')).toEqual({claimContracts:{routeGuidance:ROUTE_GUIDANCE_CONTRACT}});
    expect(claimContractStamp('terrainPoi')).toEqual({});
    expect(claimContractStamp('cartographer')).toEqual({});
  });

  // The stamp is a fact about this process. An agent that returns its own must
  // not be able to declare itself current.
  test('an agent cannot stamp its own result',async()=>{
    const {result}=await runTrailSpecialist({
      job:{agentId:'logistics',candidateId:'c1',action:'verify',claimIds:[]},
      trail:{trailId:'seceda',path:[]},context:[]},
      {at:AT,runAgent:async()=>({responseId:'r1',model:'test',data:{
        summary:'x',recommendation:'advance',openQuestions:[],claims:fullClaims(),
        claimContracts:{routeGuidance:'rg-forged00'}}})});
    expect(result.claimContracts).toEqual({routeGuidance:ROUTE_GUIDANCE_CONTRACT});
  });
});

describe('a gate holding a pre-contract dossier is refreshed, once',()=>{
  function scenario(trailOverrides={},itemOverrides={}){
    const trail={candidateId:'c1',trailId:'seceda',trailName:'Seceda Ridge',
      state:'dossier-human-gate',stage:'complete-evidence-dossier',currentJobId:'job-red',
      jobIds:['job-red','job-log'],attempts:{logistics:1},blockers:[],
      gate:{id:'dossier-approval',status:'awaiting-human',openedAt:AT},...trailOverrides};
    const item={reviewId:'r1',candidateId:'c1',trailId:'seceda',gateType:'dossier-approval',
      state:'awaiting-human',openedAt:AT,approvalAllowed:false,blockingReasons:[],
      specialistOutputs:[logisticsOutput()],...itemOverrides};
    const artifacts=new Map([['trail-orchestration',{trails:[trail]}],['dossier-review-queue',{items:[item]}]]);
    const puts=[];
    const store={
      getArtifact:async id=>artifacts.get(id)??null,
      setArtifact:async(id,value)=>{artifacts.set(id,value);},
      getJobsByIds:async()=>[{id:'job-log',candidateId:'c1',agentId:'logistics',status:'completed',completedAt:AT},
        {id:'job-red',candidateId:'c1',agentId:'redTeam',status:'completed',completedAt:AT}],
      putJob:async job=>{puts.push(job);},
    };
    return {puts,store,artifacts};
  }

  test('a stale dossier returns to research with a logistics job queued',async()=>{
    const {store,puts,artifacts}=scenario();
    const result=await advanceTrailOrchestration(store,{at:AT});
    expect(result.releasedGates).toEqual(['seceda']);
    const next=artifacts.get('trail-orchestration').trails[0];
    expect(next.state).toBe('evidence-research');
    expect(next.stage).toBe('logistics-contract-refresh');
    expect(next.gate).toBeNull();
    expect(next.claimContractRefresh).toEqual({routeGuidance:ROUTE_GUIDANCE_CONTRACT});
    // Without a pending revision the trail would advance again on the same stale
    // completed job and re-open the identical unsatisfiable gate.
    expect(next.pendingRevisionJobId).toBe(puts[0].id);
    expect(puts[0]).toEqual(expect.objectContaining({agentId:'logistics',action:'refresh-route-guidance-claims'}));
    expect(artifacts.get('dossier-review-queue').items).toHaveLength(0);
  });

  test('it is not queued a second time for the same contract',async()=>{
    const {store,puts}=scenario({claimContractRefresh:{routeGuidance:ROUTE_GUIDANCE_CONTRACT}});
    await advanceTrailOrchestration(store,{at:AT});
    expect(puts).toHaveLength(0);
  });

  test('a dossier already stamped current is left at its gate',async()=>{
    const {store,puts,artifacts}=scenario({},{specialistOutputs:[
      logisticsOutput({claimContracts:{routeGuidance:ROUTE_GUIDANCE_CONTRACT}})]});
    await advanceTrailOrchestration(store,{at:AT});
    expect(puts).toHaveLength(0);
    expect(artifacts.get('trail-orchestration').trails[0].state).toBe('dossier-human-gate');
  });

  test('a geometry gate is never touched by the route-guidance refresh',async()=>{
    const {store,puts}=scenario({state:'geometry-human-gate',stage:'route-identity-and-geometry',
      gate:{id:'geometry-approval',status:'awaiting-human',openedAt:AT}},{gateType:'geometry-approval'});
    await advanceTrailOrchestration(store,{at:AT});
    expect(puts).toHaveLength(0);
  });
});
