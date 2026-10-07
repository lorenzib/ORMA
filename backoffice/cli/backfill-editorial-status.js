#!/usr/bin/env node
'use strict';

/**
 * backfill-editorial-status — move outputs decided before #649 off
 * `ready-for-review`.
 *
 * Replays decisions already recorded in processed submissions; it decides
 * nothing and queues nothing. Dry run by default: nothing is written without
 * --apply, and the plan it prints is the plan it applies.
 *
 *   node backoffice/cli/backfill-editorial-status.js
 *   node backoffice/cli/backfill-editorial-status.js --apply
 */

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {planEditorialStatusBackfill}=require('../workflows/backfill-editorial-status');

function line(text){console.log(`[backfill] ${text}`);}

async function main(options={}){
  const store=options.store||new FirestoreBackofficeStore();
  const apply=options.apply??process.argv.slice(2).includes('--apply');

  const [execution,reviewQueue]=await Promise.all([
    store.getArtifact('verified-trail-editorial-execution'),
    store.getArtifact('content-review-queue'),
  ]);
  if(!execution){line('No verified-trail-editorial-execution artifact. Nothing to do.');return {moves:[]};}

  const plan=planEditorialStatusBackfill(execution,reviewQueue);
  const outputs=execution.outputs||[];
  line(`${outputs.length} output(s) · ${outputs.filter(output=>output.status==='ready-for-review').length} reading ready-for-review`);
  line(`${plan.decidedOutputs} output(s) carry a decision from a processed submission`);

  if(plan.errors.length){
    // Refuse rather than write an artifact the worker's own validator would
    // reject on its next pass.
    line(`REFUSED — the result would not validate: ${plan.errors.join('; ')}`);
    process.exitCode=1;
    return plan;
  }

  if(!plan.moves.length){
    line(plan.decidedOutputs
      ? 'Every decided output already carries its decision. Nothing to move.'
      : 'No decided outputs found, so nothing can be backfilled.');
    return plan;
  }

  for(const move of plan.moves){
    line(`  ${move.jobId} (${move.candidateId||'?'}) ${move.from} → ${move.to}`
      +` · ${move.action||'?'} in ${move.submissionId||'?'} · ${move.source}`);
  }

  if(!apply){line(`Dry run. Pass --apply to write these ${plan.moves.length} change(s). Nothing was changed.`);return plan;}

  await store.setArtifact('verified-trail-editorial-execution',plan.next,{lastWorkerId:'editorial-status-backfill'});
  line(`Applied ${plan.moves.length} change(s). readyForReview is now ${plan.next.summary?.readyForReview ?? '?'}.`);
  return plan;
}

if(require.main===module){
  main().catch(error=>{console.error(`[backfill] ${error.message}`);process.exitCode=1;});
}

module.exports={main};
