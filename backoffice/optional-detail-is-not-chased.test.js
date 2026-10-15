'use strict';

const {gateDecision,MAX_OPTIONAL_REVISIONS}=require('./workflows/automate-existing-trail-verification');
const {OPTIONAL_DETAIL_DISPATCHES,RESOLUTION_ATTEMPT_LIMIT,dispatchLimitFor,
  heldBySomethingUnwaivable}=require('./workflows/dispatch-unanswered-gates');

// By the time the policy is deciding, a missing route claim has already
// rejected the trail. So a gate still open is held only by optional detail --
// and the verdict is settled. Every further call buys a fuller dossier, not a
// different answer.
//
// It cost fifteen: five dispatches to logistics and ten policy revisions,
// three agents by five. "Itinéraire découverte de la nature" spent eleven
// passes that way on 15 October and came to rest without a seal, and a whole
// top-up bought about a trail and a half.

const review=blockingReasons=>({reviewId:'r',candidateId:'t',trailId:'t',trailName:'T',
  gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:false,
  blockingReasons,specialistOutputs:[],allowedActions:['approve','request-revision','reject']});

/** How many model calls the gate asks for before it settles, and on what. */
function callsBeforeVerdict(blockingReasons){
  const item=review(blockingReasons);
  let attempts={},calls=0;
  for(let round=0;round<40;round+=1){
    const orchestration={trails:[{trailId:'t',candidateId:'t',
      state:'dossier-human-gate',resolutionAttempts:{...attempts}}]};
    const decision=gateDecision(item,{items:[item]},orchestration,new Set());
    if(decision.action!=='request-revision')return {calls,verdict:decision.action};
    calls+=1;
    attempts[decision.targetAgent]=(attempts[decision.targetAgent]||0)+1;
  }
  return {calls,verdict:'never settled'};
}

const OPTIONAL=['logistics: open question — what are the car park coordinates?',
  'terrainPoi/shade: unresolved','regulatoryRanger/leash-rules: unresolved'];
const MISSING_DIRECTION=['logistics/route-number-switches: sourced route guidance is required'];

describe('a settled verdict is not researched fifteen times',()=>{
  test('optional detail alone costs three calls, and still ends in approve',()=>{
    const {calls,verdict}=callsBeforeVerdict(OPTIONAL);
    expect(verdict).toBe('approve');
    // One dispatch and one revision per agent, rather than five of each.
    expect(calls).toBeLessThanOrEqual(4);
  });

  test('a missing direction is still chased with everything available',()=>{
    // This blocker decides whether the trail can be verified at all, so the
    // calls are worth spending.
    const {calls,verdict}=callsBeforeVerdict(MISSING_DIRECTION);
    expect(verdict).toBe('reject');
    expect(calls).toBe(RESOLUTION_ATTEMPT_LIMIT);
  });

  test('the dispatch limit depends on what is holding the gate',()=>{
    expect(dispatchLimitFor(review(MISSING_DIRECTION))).toBe(RESOLUTION_ATTEMPT_LIMIT);
    expect(dispatchLimitFor(review(OPTIONAL))).toBe(OPTIONAL_DETAIL_DISPATCHES);
    expect(OPTIONAL_DETAIL_DISPATCHES).toBeLessThan(RESOLUTION_ATTEMPT_LIMIT);
  });

  test('one unwaivable blocker among optional ones keeps the full chase',()=>{
    expect(heldBySomethingUnwaivable(review([...OPTIONAL,...MISSING_DIRECTION]))).toBe(true);
    expect(heldBySomethingUnwaivable(review(OPTIONAL))).toBe(false);
  });

  test('a second look is kept, because a first pass can miss what a second finds',()=>{
    expect(MAX_OPTIONAL_REVISIONS).toBeGreaterThan(0);
    expect(OPTIONAL_DETAIL_DISPATCHES).toBeGreaterThan(0);
  });

  test('nothing outstanding is still approved without a single call',()=>{
    expect(callsBeforeVerdict([])).toEqual({calls:0,verdict:'approve'});
  });
});
