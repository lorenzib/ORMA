#!/usr/bin/env node
'use strict';

/**
 * check-dossier-approval — would approving this dossier succeed?
 *
 *   npm run backoffice:check-approval
 *   npm run backoffice:check-approval -- --candidate osm-9933643
 *
 * Read-only. It compiles each waiting dossier exactly as an approval would and
 * reports what came back, without writing a review, a registry entry or a
 * verification. Nobody is recorded as having judged anything.
 *
 * It exists because the answer was not knowable without trying: compaction
 * strips a claim's sources from the queue copy and leaves a pointer, so a
 * dossier could be refused for evidence that was sitting in the artifact the
 * pointer named. A moderator should be able to see that before committing to a
 * decision rather than after.
 */

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {rehydrateReviewQueue}=require('../workflows/rehydrate-review-detail');
const {compileVerifiedDossier,unacceptedBlockers,waivableBlocker}=require('../workflows/compile-verified-dossier');


// The blocker list is the whole dossier's unfinished business, and on Lac de la
// Thuile that was 69 reasons printed as one paragraph: unreadable, and it buried
// the only line that mattered -- two agents saying block. These shape it into
// what a person decides from.
const BLOCKERS_SHOWN=4;

/** "redTeam: recommendation is block" -> redTeam. */
function agentOf(reason){
  const [head]=String(reason||'').split(/[/:]/);
  return head.trim()||'unattributed';
}

/** The agents refusing outright, which outrank any count of loose ends. */
function blockingAgents(reasons){
  return [...new Set((reasons||[])
    .filter(reason=>/recommendation is block\b/.test(String(reason)))
    .map(agentOf))].sort();
}

function byAgent(reasons){
  const counts=new Map();
  for(const reason of reasons||[]) counts.set(agentOf(reason),(counts.get(agentOf(reason))||0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]);
}

/**
 * compileVerifiedDossier reports a blocked dossier by listing every blocker in
 * the message. That is the decision restated, not a diagnosis, so it is cut to
 * its first clause and the blockers are reported in their own right.
 */
function shortError(message){
  const text=String(message||'');
  const blocked=/^A blocked dossier cannot be compiled as verified:/.exec(text);
  if(blocked) return 'the blockers below have not been accepted';
  return text.split(';')[0].slice(0,160);
}

function option(args,name,fallback){
  const index=args.indexOf(name);
  return index>=0&&args[index+1]?args[index+1]:fallback;
}

async function main(options={}){
  const args=options.argv||process.argv.slice(2);
  const candidateId=String(option(args,'--candidate','')).trim()||null;
  const store=options.store||new FirestoreBackofficeStore();
  const [queue,orchestration]=await Promise.all([
    store.getArtifact('dossier-review-queue'),
    store.getArtifact('trail-orchestration'),
  ]);
  const waiting=(queue?.items||[]).filter(item=>item.gateType==='dossier-approval'&&item.state==='awaiting-human')
    .filter(item=>!candidateId||item.candidateId===candidateId||item.trailId===candidateId);

  console.log(`[approval-check] ${waiting.length} dossier(s) awaiting a decision.`);
  const results=[];
  for(const item of waiting){
    const hydrated=await rehydrateReviewQueue(store,queue,item.reviewId);
    const review=(hydrated.items||[]).find(entry=>entry.reviewId===item.reviewId);
    const restored=(review.specialistOutputs||[]).some(output=>output.rehydratedFrom);
    const trail=(orchestration?.trails||[]).find(entry=>entry.candidateId===review.candidateId)
      ||{candidateId:review.candidateId,trailId:review.trailId,trailName:review.trailName};

    // Blockers a moderator would have to accept are not a failure of the
    // machinery; they are the decision itself. Separated so the two are not
    // reported as the same thing.
    const standing=unacceptedBlockers(review,[]);
    const unwaivable=standing.filter(reason=>!waivableBlocker(reason));

    let compiles=null;let error=null;
    try{ compileVerifiedDossier(review,trail,{at:new Date().toISOString(),acceptedBlockers:standing}); compiles=true; }
    catch(failure){ compiles=false; error=String(failure.message||failure); }

    const refusing=blockingAgents(standing);
    const entry={trailId:review.trailId,trailName:review.trailName,detailRestored:restored,
      wouldCompile:compiles,error,blockersToAccept:standing.length,unacceptableBlockers:unwaivable,
      blockingAgents:refusing,blockersByAgent:byAgent(standing),blockers:standing};
    results.push(entry);
    console.log(`[approval-check] ${review.trailName||review.trailId}`);
    console.log(`[approval-check]   evidence restored from the pointer: ${restored?'yes':'not needed'}`);
    console.log(`[approval-check]   compiles as verified: ${compiles?'yes':`no — ${shortError(error)}`}`);
    // An agent refusing outright is a different answer from a pile of loose
    // ends, and it is the one that decides whether approving is even on offer.
    if(refusing.length) console.log(`[approval-check]   recommending block: ${refusing.join(', ')}`);
    if(unwaivable.length){
      console.log(`[approval-check]   ${unwaivable.length} cannot be accepted, only supplied:`);
      for(const reason of unwaivable.slice(0,BLOCKERS_SHOWN)) console.log(`[approval-check]     - ${reason.slice(0,150)}`);
      if(unwaivable.length>BLOCKERS_SHOWN) console.log(`[approval-check]     ... and ${unwaivable.length-BLOCKERS_SHOWN} more`);
    }
    if(standing.length){
      console.log(`[approval-check]   ${standing.length} blocker(s) a moderator would accept with a reason:`);
      for(const [agent,count] of byAgent(standing)) console.log(`[approval-check]     ${agent}: ${count}`);
      for(const reason of standing.slice(0,BLOCKERS_SHOWN)) console.log(`[approval-check]     - ${reason.slice(0,150)}`);
      if(standing.length>BLOCKERS_SHOWN) console.log(`[approval-check]     ... and ${standing.length-BLOCKERS_SHOWN} more, in the JSON above`);
    }
  }
  console.log('\n[approval-check] Nothing was changed. No review, registry entry or verification was written.');
  return results;
}

if(require.main===module)main().catch(error=>{console.error(`[approval-check] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={option,agentOf,blockingAgents,byAgent,shortError,main};
