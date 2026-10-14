'use strict';

/**
 * Does the research ladder pay for itself?
 *
 * A claim the agents cannot answer is researched up to MAX_AUTOMATED_ATTEMPTS
 * times, each attempt a web search a reader never sees unless it succeeds. For
 * a waivable claim the end of the ladder and the second attempt reach the same
 * place -- the claim is recorded unknown and the trail is approved anyway -- so
 * every attempt after the last one that would have succeeded is spent for
 * nothing.
 *
 * This counts which attempt actually produced each answer, so the ladder's
 * length is set from what it yields rather than from an intuition about it.
 * Reads the orchestration artifact the state report already loads, so it costs
 * no extra Firestore reads and never calls a model.
 */

const {ROUTE_GUIDANCE_CLAIM_IDS}=require('./compile-verified-dossier');
const {MAX_AUTOMATED_ATTEMPTS}=require('../contracts/resolution-policy-v1');

const RESOLVED=['supported','contradicted'];

/** Route guidance is unwaivable, so its ladder is not a candidate for cutting. */
function isRouteGuidance(claimId){
  return ROUTE_GUIDANCE_CLAIM_IDS.includes(String(claimId||''));
}

/**
 * Every claim ledger entry across every trail, with the attempt it ended on.
 *
 * `attempts` is the history of strategies run, so its length is how many
 * searches the claim cost. A claim that resolved on its first look has one.
 */
function ledgerEntries(orchestration){
  return (orchestration?.trails||[]).flatMap(trail=>
    Object.values(trail.claimResolution||{}).map(entry=>({
      trailId:trail.trailId||trail.candidateId||null,
      agentId:entry.agentId||null,
      claimId:entry.claimId||null,
      claim:`${entry.agentId}/${entry.claimId}`,
      state:entry.state||null,
      attempts:Array.isArray(entry.attempts)?entry.attempts.length:0,
      routeGuidance:isRouteGuidance(entry.claimId),
    })));
}

/**
 * What the ladder bought, and what it would have bought if it were shorter.
 *
 * `savedAt` answers the question directly: cutting waivable claims to N
 * attempts costs the answers that arrived after N, and saves every attempt
 * those claims spent beyond it.
 */
function resolutionYield(orchestration,options={}){
  const entries=ledgerEntries(orchestration);
  const waivable=entries.filter(entry=>!entry.routeGuidance);
  const resolved=waivable.filter(entry=>RESOLVED.includes(entry.state));
  const byAttempt=new Map();
  for(const entry of resolved){
    byAttempt.set(entry.attempts,(byAttempt.get(entry.attempts)||0)+1);
  }
  const ceiling=Number.isInteger(options.ceiling)&&options.ceiling>0
    ?options.ceiling:MAX_AUTOMATED_ATTEMPTS;
  const savedAt=[];
  for(let cut=1;cut<=ceiling;cut+=1){
    // An answer that arrived on a later attempt than the cut would be lost.
    const lost=resolved.filter(entry=>entry.attempts>cut).length;
    // Every waivable claim pays for attempts beyond the cut, whether it
    // resolved there or exhausted.
    const saved=waivable.reduce((total,entry)=>total+Math.max(0,entry.attempts-cut),0);
    savedAt.push({cut,answersLost:lost,searchesSaved:saved});
  }
  // Route guidance decides whether a trail can be verified at all, and it is
  // resolved in the same pool as the optional detail. A trail whose directions
  // cannot be established has already paid for everything else by the time
  // anyone finds out, so the size of that waste is worth reporting beside the
  // ladder's yield.
  const guidance=entries.filter(entry=>entry.routeGuidance);
  const guidanceStates={};
  for(const entry of guidance)guidanceStates[entry.state||'unknown']=(guidanceStates[entry.state||'unknown']||0)+1;
  // Which of the four, specifically.
  //
  // A trail needs all four of these, so the aggregate hides the thing worth
  // knowing: four claims each answered seven times in ten still only clear a
  // trail a quarter of the time, and if one of the four is answered far less
  // often than the others it is that one rule holding the pipeline, not the
  // contract as a whole. The aggregate cannot tell those two cases apart and
  // they call for opposite fixes.
  const byClaim=ROUTE_GUIDANCE_CLAIM_IDS.map(claimId=>{
    const forClaim=guidance.filter(entry=>entry.claimId===claimId);
    const states={};
    for(const entry of forClaim)states[entry.state||'unknown']=(states[entry.state||'unknown']||0)+1;
    return {
      claimId,
      total:forClaim.length,
      supported:states.supported||0,
      sourceExhausted:states['source-exhausted']||0,
      contradicted:states.contradicted||0,
      researchable:states.researchable||0,
      searches:forClaim.reduce((total,entry)=>total+entry.attempts,0),
    };
  });
  // Trails with no direction still outstanding in the ledger.
  //
  // NOT "all four supported": the ledger only holds claims an agent could not
  // answer first time, so a trail whose directions came straight back has no
  // entry for them and could never satisfy that. Reported as 0 of 24 on its
  // first live run, which was an artefact of the question, not the pipeline.
  // What it can honestly say is that nothing about this trail's directions is
  // still open.
  const guidanceByTrail=new Map();
  for(const entry of guidance){
    if(!guidanceByTrail.has(entry.trailId))guidanceByTrail.set(entry.trailId,new Map());
    guidanceByTrail.get(entry.trailId).set(entry.claimId,entry.state);
  }
  const trailsWithAllFour=[...guidanceByTrail.entries()]
    .filter(([,claims])=>[...claims.values()].every(state=>state==='supported'))
    .map(([trailId])=>trailId);
  const doomedTrails=[...new Set(guidance
    .filter(entry=>entry.state==='source-exhausted'||entry.state==='contradicted')
    .map(entry=>entry.trailId))];
  const wastedOnDoomed=waivable
    .filter(entry=>doomedTrails.includes(entry.trailId))
    .reduce((total,entry)=>total+entry.attempts,0);
  return {
    claims:entries.length,
    guidanceStates,
    guidanceByClaim:byClaim,
    trailsWithNoDirectionOutstanding:trailsWithAllFour,
    trailsWithAnyDirection:guidanceByTrail.size,
    doomedTrails:doomedTrails.length,
    wastedOnDoomed,
    waivableClaims:waivable.length,
    routeGuidanceClaims:entries.length-waivable.length,
    resolved:resolved.length,
    exhausted:waivable.filter(entry=>entry.state==='source-exhausted').length,
    searchesSpentOnWaivable:waivable.reduce((total,entry)=>total+entry.attempts,0),
    resolvedOnAttempt:[...byAttempt.entries()].sort((a,b)=>a[0]-b[0])
      .map(([attempt,count])=>({attempt,count})),
    savedAt,
  };
}

module.exports={RESOLVED,isRouteGuidance,ledgerEntries,resolutionYield};
