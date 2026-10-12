'use strict';

const {resolutionYield,ledgerEntries,isRouteGuidance}=require('./workflows/resolution-yield');
const {MAX_AUTOMATED_ATTEMPTS}=require('./contracts/resolution-policy-v1');
const {ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier');

/**
 * A waivable claim that exhausts the ladder is recorded unknown and the trail
 * is approved anyway, so every attempt after the one that would have answered
 * it is spent for nothing. This measures which attempt actually answered,
 * so the ladder's length is a decision rather than an assumption.
 */

const claim=(agentId,claimId,state,attempts)=>
  ({agentId,claimId,state,attempts:Array.from({length:attempts},(_,i)=>i+1)});
const orchestration=entries=>({trails:[{trailId:'t1',
  claimResolution:Object.fromEntries(entries.map((entry,index)=>[`c${index}`,entry]))}]});

describe('which attempt produced the answer',()=>{
  test('an answer is credited to the attempt it arrived on',()=>{
    const result=resolutionYield(orchestration([
      claim('terrainPoi','water','supported',1),
      claim('terrainPoi','shade','supported',3),
      claim('terrainPoi','livestock','supported',3),
    ]));
    expect(result.resolvedOnAttempt).toEqual([{attempt:1,count:1},{attempt:3,count:2}]);
  });

  test('a claim that exhausted is counted as spend, not as an answer',()=>{
    const result=resolutionYield(orchestration([
      claim('terrainPoi','shade','source-exhausted',MAX_AUTOMATED_ATTEMPTS),
    ]));
    expect(result.resolved).toBe(0);
    expect(result.exhausted).toBe(1);
    expect(result.searchesSpentOnWaivable).toBe(MAX_AUTOMATED_ATTEMPTS);
  });

  // Route guidance is unwaivable, so shortening its ladder would change what a
  // trail can be verified on. It is counted apart and never in the saving.
  test('route guidance is held apart from the waivable claims',()=>{
    const result=resolutionYield(orchestration([
      claim('logistics','route-number-switches','source-exhausted',5),
      claim('terrainPoi','shade','source-exhausted',5),
    ]));
    expect(result.routeGuidanceClaims).toBe(1);
    expect(result.waivableClaims).toBe(1);
    expect(result.searchesSpentOnWaivable).toBe(5);
    expect(result.savedAt.find(row=>row.cut===2).searchesSaved).toBe(3);
  });

  test('every route-guidance claim id is recognised as one',()=>{
    for(const id of ROUTE_GUIDANCE_CLAIM_IDS) expect(isRouteGuidance(id)).toBe(true);
    expect(isRouteGuidance('shade')).toBe(false);
    expect(isRouteGuidance(null)).toBe(false);
  });
});

describe('what a shorter ladder would have cost',()=>{
  const result=()=>resolutionYield(orchestration([
    claim('terrainPoi','water','supported',1),
    claim('terrainPoi','livestock','supported',4),
    claim('terrainPoi','shade','source-exhausted',5),
  ]));

  test('a cut below an answer loses it',()=>{
    expect(result().savedAt.find(row=>row.cut===2).answersLost).toBe(1);
  });

  test('a cut above every answer loses none',()=>{
    expect(result().savedAt.find(row=>row.cut===4).answersLost).toBe(0);
  });

  test('the saving counts every attempt beyond the cut, answered or not',()=>{
    // water 1, livestock 4, shade 5, cut at 2 -> 0 + 2 + 3
    expect(result().savedAt.find(row=>row.cut===2).searchesSaved).toBe(5);
  });

  test('cutting at the current ladder saves nothing, which is the control',()=>{
    const row=result().savedAt.find(entry=>entry.cut===MAX_AUTOMATED_ATTEMPTS);
    expect(row).toEqual({cut:MAX_AUTOMATED_ATTEMPTS,answersLost:0,searchesSaved:0});
  });
});

describe('it reads what is already loaded',()=>{
  test('an empty or missing orchestration measures nothing rather than throwing',()=>{
    expect(resolutionYield(null).claims).toBe(0);
    expect(resolutionYield({trails:[]}).claims).toBe(0);
    expect(ledgerEntries({trails:[{trailId:'t1'}]})).toEqual([]);
  });

  test('a claim with no attempt history counts as zero searches',()=>{
    const [entry]=ledgerEntries({trails:[{trailId:'t1',
      claimResolution:{a:{agentId:'terrainPoi',claimId:'shade',state:'researchable'}}}]});
    expect(entry.attempts).toBe(0);
  });
});
