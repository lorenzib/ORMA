#!/usr/bin/env node
'use strict';

/**
 * submit-review — record a moderator decision from a credentialed context
 * (CLI / workflow) instead of the browser desk. It writes exactly the queued
 * review doc the desk writes, so the worker's apply step reads it identically.
 *
 * The gate is still a human gate: this is only the transport. It will NOT
 * approve a dossier gate that still has un-waived blockers (same rule the desk
 * enforces) -- a clean gate (approvalAllowed) or every blocker explicitly
 * waived with a reason.
 *
 * Dry run by default; nothing is written without --apply.
 *
 *   node backoffice/cli/submit-review.js --candidate osm-7388748            (dry run: approve a ready gate)
 *   node backoffice/cli/submit-review.js --candidate osm-7388748 --apply
 *   node backoffice/cli/submit-review.js --candidate osm-1 --action request-revision --note '...' --apply
 *   node backoffice/cli/submit-review.js --kind route --candidate osm-relation-1484751 \
 *        --action approve-route-variants --proposals tre-cime-classic-101-105,other-id --apply
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');

const ROUTE_GUIDANCE = /recommended-start|route-number-status|route-number-sequence|route-number-switches|supported authoritative route guidance/i;

function parseArgs(argv){
  const out = { kind:'dossier', candidate:null, action:null, note:'', proposals:[],
    acceptedBlockers:[], reviewId:null, by:'backoffice-cli', apply:false };
  for(let i=0;i<argv.length;i+=1){
    const a=argv[i];
    if(a==='--kind'){ out.kind=argv[i+=1]; continue; }
    if(a==='--candidate'){ out.candidate=argv[i+=1]; continue; }
    if(a==='--action'){ out.action=argv[i+=1]; continue; }
    if(a==='--note'){ out.note=argv[i+=1]; continue; }
    if(a==='--review-id'){ out.reviewId=argv[i+=1]; continue; }
    if(a==='--by'){ out.by=argv[i+=1]; continue; }
    if(a==='--proposals'){ out.proposals=String(argv[i+=1]||'').split(',').map(s=>s.trim()).filter(Boolean); continue; }
    if(a==='--accept-blocker'){ // "blocker:reason"
      const raw=String(argv[i+=1]||''); const idx=raw.indexOf(':');
      out.acceptedBlockers.push(idx>0?{blocker:raw.slice(0,idx).trim(),reason:raw.slice(idx+1).trim()}:{blocker:raw.trim(),reason:''});
      continue;
    }
    if(a==='--apply'){ out.apply=true; continue; }
  }
  return out;
}

async function planDossier(store, args){
  const queue = await store.getArtifact('dossier-review-queue') || { items:[] };
  const item = (queue.items||[]).find(i => i.state==='awaiting-human'
    && (String(i.candidateId)===args.candidate || String(i.trailId)===args.candidate || String(i.reviewId)===args.reviewId));
  if(!item) throw new Error(`No awaiting-human dossier review for "${args.candidate}". Run with no --apply against a different candidate, or check the queue.`);
  const action = args.action || 'approve';
  const blockers = (item.blockingReasons || item.blockers || []).map(String);
  if(action==='approve'){
    // Route-guidance blockers can never be waived -- they have to be supplied
    // (request-revision to logistics). A gate carrying one cannot be approved,
    // no matter what is passed to --accept-blocker.
    const guidance = blockers.filter(b => ROUTE_GUIDANCE.test(b));
    if(guidance.length) throw new Error(`Cannot approve ${args.candidate}: route-guidance blockers must be supplied, not waived: ${guidance.join('; ')}`);
    const accepted = new Set(args.acceptedBlockers.map(b=>b.blocker));
    const standing = (item.approvalAllowed===true) ? [] : blockers.filter(b => !accepted.has(b));
    if(standing.length) throw new Error(`Cannot approve ${args.candidate}: ${standing.length} blocker(s) not waived. Pass --accept-blocker "<blocker>:<reason>" for each, or send it back. Standing: ${standing.join('; ')}`);
    const missingReason = args.acceptedBlockers.filter(b => !b.reason);
    if(missingReason.length) throw new Error(`Each --accept-blocker needs a reason ("blocker:reason"). Missing: ${missingReason.map(b=>b.blocker).join(', ')}`);
  } else if(action==='request-revision'){
    if(!args.note.trim()) throw new Error('request-revision needs a precise --note.');
  } else if(action!=='reject'){
    throw new Error(`Unknown dossier action "${action}" (approve | request-revision | reject).`);
  }
  return { collection:'backofficeDossierReviews', payload:{
    reviewId:item.reviewId, candidateId:item.candidateId, action,
    targetAgent:item.targetAgent||'', note:args.note,
    acceptedBlockers: action==='approve' ? args.acceptedBlockers : [],
    submittedBy:args.by,
  }, context:{ gate:item.gateType, trail:item.trailName||item.candidateId, approvalAllowed:item.approvalAllowed, blockers } };
}

async function planRoute(store, args){
  const review = await store.getArtifact('route-review') || { items:[] };
  const item = (review.items||[]).find(i => String(i.candidateId)===args.candidate);
  if(!item) throw new Error(`No route-review item for "${args.candidate}".`);
  const action = args.action;
  if(!action) throw new Error('Route review needs --action (approve-route | approve-route-variants | request-route-research | reject-route-source).');
  if(/^approve/.test(action) && !args.proposals.length) throw new Error('Keeping a route needs --proposals <id,...>.');
  return { collection:'backofficeRouteReviews', payload:{
    candidateId:item.candidateId, action, proposalIds:args.proposals, note:args.note, submittedBy:args.by,
  }, context:{ title:item.title||item.candidateId, reviewState:item.reviewState,
    proposals:(item.proposals||[]).map(p=>p.id) } };
}

async function main(){
  const args = parseArgs(process.argv.slice(2));
  if(!args.candidate){ console.error('[submit-review] --candidate is required.'); process.exit(1); }
  const store = new FirestoreBackofficeStore();
  const plan = args.kind==='route' ? await planRoute(store,args) : await planDossier(store,args);
  console.log(`[submit-review] ${args.kind} decision for ${args.candidate}`);
  console.log(`[submit-review]   ${JSON.stringify({ ...plan.payload, context:plan.context })}`);
  if(!args.apply){
    console.log('[submit-review] Dry run. Nothing written. Re-run with --apply to submit it.');
    return;
  }
  const result = args.kind==='route'
    ? await store.submitRouteReview(plan.payload)
    : await store.submitDossierReview(plan.payload);
  if(!result || result.ok===false) throw new Error(result && result.error || 'submit failed');
  console.log(`[submit-review] Submitted · ${plan.collection}/${result.reviewId} (status: ${result.status}). The next worker run applies it.`);
}

if(require.main===module){
  main().catch(error => { console.error(`[submit-review] ${error.message}`); process.exit(1); });
}

module.exports = { parseArgs, planDossier, planRoute };
