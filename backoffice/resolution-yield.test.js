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

// Route guidance decides whether a trail can be verified at all, and it is
// resolved in the same pool as the optional detail. A trail whose directions
// cannot be established has already paid for everything else by then.
describe('what a doomed trail cost before anyone knew',()=>{
  const trail=(trailId,entries)=>({trailId,
    claimResolution:Object.fromEntries(entries.map((entry,index)=>[`c${index}`,entry]))});
  const yielded=trails=>resolutionYield({trails});

  test('a trail whose directions exhausted is counted as doomed',()=>{
    const result=yielded([trail('t1',[
      claim('logistics','route-number-sequence','source-exhausted',5),
      claim('terrainPoi','shade','source-exhausted',5),
      claim('terrainPoi','water','supported',2),
    ])]);
    expect(result.doomedTrails).toBe(1);
    // Everything spent on that trail's optional claims: 5 + 2.
    expect(result.wastedOnDoomed).toBe(7);
  });

  test('a trail whose directions hold is not counted, however much it spent',()=>{
    const result=yielded([trail('t1',[
      claim('logistics','route-number-sequence','supported',4),
      claim('terrainPoi','shade','source-exhausted',5),
    ])]);
    expect(result.doomedTrails).toBe(0);
    expect(result.wastedOnDoomed).toBe(0);
  });

  test('contradicted directions doom a trail just as exhausted ones do',()=>{
    expect(yielded([trail('t1',[
      claim('logistics','recommended-start','contradicted',3),
      claim('terrainPoi','shade','supported',1),
    ])]).doomedTrails).toBe(1);
  });

  test('the states of the route claims are reported, not just the count',()=>{
    const result=yielded([trail('t1',[
      claim('logistics','recommended-start','supported',1),
      claim('logistics','route-number-switches','source-exhausted',5),
    ])]);
    expect(result.guidanceStates).toEqual({supported:1,'source-exhausted':1});
  });

  test('one doomed trail is counted once however many directions failed',()=>{
    expect(yielded([trail('t1',[
      claim('logistics','route-number-sequence','source-exhausted',5),
      claim('logistics','route-number-switches','source-exhausted',5),
      claim('terrainPoi','shade','supported',1),
    ])]).doomedTrails).toBe(1);
  });
});

// A trail needs all four route-guidance claims, so the aggregate hides the
// thing worth knowing. Four claims each answered seven times in ten clear a
// trail only a quarter of the time; one claim answered twice in ten with the
// other three near-certain looks identical in the aggregate and calls for the
// opposite fix. The claim ids come from the producer, so requiring a fifth
// claim shows up here rather than being silently left out of the breakdown.
describe('which of the four directions is the one blocking',()=>{
  const trail=(trailId,states)=>({trailId,
    claimResolution:Object.fromEntries(Object.entries(states).map(([claimId,state],index)=>
      [`c${index}`,{agentId:'logistics',claimId,state,attempts:[1]}])) });

  const allFour=state=>Object.fromEntries(ROUTE_GUIDANCE_CLAIM_IDS.map(id=>[id,state]));

  test('every route-guidance claim is reported, in the producer’s own list',()=>{
    const result=resolutionYield({trails:[trail('t1',allFour('supported'))]});
    expect(result.guidanceByClaim.map(row=>row.claimId)).toEqual([...ROUTE_GUIDANCE_CLAIM_IDS]);
    expect(result.guidanceByClaim.every(row=>row.supported===1&&row.total===1)).toBe(true);
  });

  test('one unanswerable claim is named rather than averaged away',()=>{
    const hard=ROUTE_GUIDANCE_CLAIM_IDS[ROUTE_GUIDANCE_CLAIM_IDS.length-1];
    const states=allFour('supported');
    states[hard]='source-exhausted';
    const result=resolutionYield({trails:[trail('t1',states),trail('t2',states)]});
    const row=result.guidanceByClaim.find(item=>item.claimId===hard);
    expect(row).toEqual(expect.objectContaining({supported:0,sourceExhausted:2,total:2}));
    // The other three look healthy, which is exactly why the aggregate misleads.
    expect(result.guidanceByClaim.filter(item=>item.claimId!==hard)
      .every(item=>item.supported===2)).toBe(true);
  });

  // The ledger holds only the claims an agent could not answer first time, so
  // "all four supported" is a question it can never answer yes to: a trail
  // whose directions came straight back has no entry for them at all. It read
  // 0 of 24 on its first live run for that reason alone. What it can say is
  // whether anything about a trail's directions is still outstanding.
  test('a trail is settled when none of its researched directions is outstanding',()=>{
    const short=allFour('supported');
    short[ROUTE_GUIDANCE_CLAIM_IDS[0]]='source-exhausted';
    const result=resolutionYield({trails:[
      trail('complete',allFour('supported')),
      trail('one-short',short),
      // One direction, answered. Nothing outstanding, even though three of the
      // four never reached the ledger.
      trail('answered-first-time',{[ROUTE_GUIDANCE_CLAIM_IDS[0]]:'supported'}),
    ]});
    expect(result.trailsWithNoDirectionOutstanding).toEqual(['complete','answered-first-time']);
    expect(result.trailsWithAnyDirection).toBe(3);
  });

  test('a direction still being researched leaves the trail outstanding',()=>{
    const result=resolutionYield({trails:[
      trail('still-looking',{[ROUTE_GUIDANCE_CLAIM_IDS[0]]:'researchable'}),
    ]});
    expect(result.trailsWithNoDirectionOutstanding).toEqual([]);
  });
});
