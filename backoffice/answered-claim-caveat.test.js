'use strict';

const {dossierBlockingReasons,waivableBlocker,blockerId,ROUTE_GUIDANCE_CLAIM_IDS}
  =require('./workflows/compile-verified-dossier');
const {gateDecision}=require('./workflows/automate-existing-trail-verification');

// Tre Cime's agent did exactly what the prompt asks: it established the Rifugio
// Locatelli switch, cited it to the Consorzio Turistico, and noted that no
// coordinate or distance-from-start had been published for it. The note was
// filed under the claim's own id, which is in the class no reason can waive --
// a class written for a claim with no answer at all.
//
// So the gate rejected the best-documented walk in the catalogue because its
// agent had been thorough. An agent that found the switch and said nothing
// else would have passed.

const SOURCE={label:'Operator',url:'https://example.test/route',authority:'Consorzio Turistico'};

function logistics(over={}){
  return {agentId:'logistics',result:{recommendation:'advance',openQuestions:[],
    claims:ROUTE_GUIDANCE_CLAIM_IDS.map(id=>({
      id,category:'access',finding:'supported-proposal',confidence:0.9,
      proposedValue:'At Rifugio Locatelli, leave trail 101 and take trail 105.',
      rationale:'From the operator page.',sources:[SOURCE],
      blockers:[],...(over[id]||{})}))}};
}

const NOTE='No authoritative coordinate or distance-from-start for the Rifugio Locatelli switch was published by the checked route pages.';

describe('a note on an answered claim is not a missing answer',()=>{
  test('the note is kept, and it no longer refuses the trail',()=>{
    const reasons=dossierBlockingReasons([logistics({'route-number-switches':{blockers:[NOTE]}})]);
    expect(reasons).toHaveLength(1);
    // Kept: somebody may still go and find that coordinate.
    expect(reasons[0]).toContain(NOTE);
    expect(waivableBlocker(reasons[0])).toBe(true);
    // Filed under the claim it belongs to, so it still reaches that agent.
    expect(blockerId(reasons[0])).toBe('logistics/route-number-switches-caveat');
  });

  test('a claim with no answer still refuses the trail',()=>{
    const unanswered=logistics({'route-number-switches':{finding:'unresolved',sources:[],
      blockers:['The route pages do not describe where the number changes.']}});
    const reasons=dossierBlockingReasons([unanswered]);
    const unwaivable=reasons.filter(reason=>!waivableBlocker(reason)).map(blockerId);
    // Both the missing claim itself and its own blocker stay unwaivable.
    expect(unwaivable).toContain('logistics/route-number-switches');
    expect(unwaivable.length).toBeGreaterThan(0);
  });

  test('a caveat on an answered claim does not make an unanswered one waivable',()=>{
    const mixed=logistics({
      'route-number-switches':{blockers:[NOTE]},
      'recommended-start':{finding:'unresolved',sources:[],blockers:[]},
    });
    const reasons=dossierBlockingReasons([mixed]);
    // An unanswered claim files twice -- its own finding and the route-guidance
    // requirement -- and both are the same id.
    const unwaivable=[...new Set(reasons.filter(reason=>!waivableBlocker(reason)).map(blockerId))];
    expect(unwaivable).toEqual(['logistics/recommended-start']);
  });

  test('a note from another agent is untouched',()=>{
    const terrain={agentId:'terrainPoi',result:{recommendation:'advance',openQuestions:[],
      claims:[{id:'water',finding:'supported-proposal',proposedValue:'A fountain.',
        sources:[SOURCE],blockers:['Seasonal availability unconfirmed.']}]}};
    // With no logistics output at all, the four directions are missing and lead
    // the list; the terrain note is what this test is about.
    const reason=dossierBlockingReasons([terrain]).find(item=>item.startsWith('terrainPoi/'));
    expect(blockerId(reason)).toBe('terrainPoi/water');
    expect(waivableBlocker(reason)).toBe(true);
  });

  test('Tre Cime’s shape is approved rather than rejected',()=>{
    const outputs=[logistics({'route-number-switches':{blockers:[NOTE]}})];
    const blockingReasons=dossierBlockingReasons(outputs);
    const review={reviewId:'r',candidateId:'tre-cime',trailId:'tre-cime',trailName:'Tre Cime',
      gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:false,
      blockingReasons,specialistOutputs:outputs,allowedActions:['approve','request-revision','reject']};
    const orchestration={trails:[{trailId:'tre-cime',candidateId:'tre-cime',
      state:'dossier-human-gate',resolutionAttempts:{logistics:5}}]};
    const decision=gateDecision(review,{items:[review]},orchestration,new Set());
    expect(decision.action).toBe('approve');
    // Accepted as unknown, never promoted to a fact.
    expect(decision.acceptedBlockers.map(entry=>entry.blocker)).toEqual(blockingReasons);
  });
});

// The other half of the same rule, found 15 October 2026.
//
// The caveat test was applied to a claim's notes and not to its own finding, so
// an agent that answered "unresolved" while the map had the answer still filed
// an unwaivable refusal. Anello di Ciampeviei is what that looked like from
// outside: the dry-run printed "route-number-switches answered by the map" and
// rejected the trail for route-number-switches being unknown, in one report.
// 23 of the 34 trails nearest the seal were held that way.
describe('a finding on a claim the map answered is not a missing answer',()=>{
  // The map establishes the order of the numbers and where one gives way to
  // the next. A loop that stays on one number has no decision point, and the
  // measurement says so rather than leaving it blank.
  const cartographer={agentId:'cartographer',result:{
    source:{externalId:'relation/7548201',relations:[{externalRelationId:'relation/7548201',ref:'69'}]},
    routeGuidance:{sequence:['69'],switches:[]}}};

  const agentGaveUpOnSwitches=()=>logistics({'route-number-switches':{
    finding:'unresolved',proposedValue:'',sources:[],blockers:[]}});

  test('the trail is no longer refused for a claim the map answered',()=>{
    const reasons=dossierBlockingReasons([agentGaveUpOnSwitches(),cartographer]);
    expect(reasons.some(reason=>!waivableBlocker(reason))).toBe(false);
  });

  test('the finding is kept, under the claim it belongs to',()=>{
    // Not dropped: the agent's answer is still true, still reaches the desk,
    // and still goes round the resolution ladder.
    const reasons=dossierBlockingReasons([agentGaveUpOnSwitches(),cartographer]);
    const theOne=reasons.find(reason=>reason.includes('route-number-switches'));
    expect(theOne).toContain('unresolved');
    expect(blockerId(theOne)).toBe('logistics/route-number-switches-caveat');
  });

  test('with nothing to answer it, the claim still refuses the trail',()=>{
    // The guard that matters. Without the map nothing answers it anywhere, and
    // a walk nobody can give directions for must not verify.
    const reasons=dossierBlockingReasons([agentGaveUpOnSwitches()]);
    const theOne=reasons.find(reason=>reason.includes('route-number-switches'));
    expect(blockerId(theOne)).toBe('logistics/route-number-switches');
    expect(waivableBlocker(theOne)).toBe(false);
  });

  test('a claim the map cannot answer is unaffected',()=>{
    // The map establishes the order and the switches, never the start. An
    // unresolved start has to keep refusing, or a walk with no findable
    // beginning would verify.
    const noStart=logistics({'recommended-start':{
      finding:'unresolved',proposedValue:'',sources:[],blockers:[]}});
    const reasons=dossierBlockingReasons([noStart,cartographer]);
    const theOne=reasons.find(reason=>reason.includes('recommended-start'));
    expect(blockerId(theOne)).toBe('logistics/recommended-start');
    expect(waivableBlocker(theOne)).toBe(false);
  });

  test('an ordinary claim is not touched by this rule',()=>{
    // Scoped to the four route claims. A terrain claim that came back
    // unresolved is ordinary optional detail and keeps its own id.
    const withTerrain={agentId:'terrainPoi',result:{recommendation:'advance',openQuestions:[],
      claims:[{id:'livestock',category:'terrain',finding:'unresolved',proposedValue:'',sources:[],blockers:[]}]}};
    const reasons=dossierBlockingReasons([withTerrain,cartographer]);
    expect(reasons).toContain('terrainPoi/livestock: unresolved');
  });
});
