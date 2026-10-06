#!/usr/bin/env node
'use strict';

/**
 * requeue-fixed-jobs — run blocked jobs again once their cause has been fixed.
 *
 *   npm run backoffice:requeue-fixed -- --error-pattern 'cannot be answered "varies"'
 *   npm run backoffice:requeue-fixed -- --error-pattern '...' --reason 'prompt now states the rule' --apply
 *
 * Without --apply it changes nothing and prints what it would release. The
 * error must be named: there is no "requeue everything blocked", because
 * releasing jobs whose cause is still live spends the model budget to re-learn
 * it. Bounded per pass for the same reason.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { planRequeue, requeueFields } = require('../workflows/requeue-fixed-jobs');

function parseArgs(argv){
  const out = { jobTypes: [], limit: 10, apply: false, errorPattern: '', reason: 'the cause was fixed', candidateId: null };
  for(let i = 0; i < argv.length; i += 1){
    const arg = argv[i];
    if(arg === '--error-pattern'){ out.errorPattern = argv[i += 1]; continue; }
    if(arg === '--job-type'){ out.jobTypes.push(argv[i += 1]); continue; }
    if(arg === '--candidate'){ out.candidateId = argv[i += 1]; continue; }
    if(arg === '--reason'){ out.reason = argv[i += 1]; continue; }
    if(arg === '--limit'){ out.limit = Number.parseInt(argv[i += 1], 10) || 10; continue; }
    if(arg === '--apply'){ out.apply = true; continue; }
  }
  return out;
}

async function main(options = {}){
  const args = parseArgs(options.argv || process.argv.slice(2));
  const store = options.store || new FirestoreBackofficeStore();
  const blocked = (await store.listJobs(['blocked'])).filter(job => job.status === 'blocked');

  if(!args.errorPattern){
    // The first question is always "blocked on what?".
    const counts = new Map();
    for(const job of blocked){
      const key = String(job.lastError || '(no error recorded)').slice(0, 110);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    console.log(`[requeue] ${blocked.length} blocked job(s). Name one of these with --error-pattern:`);
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([error, count]) => console.log(`[requeue]   ${count}x ${error}`));
    console.log('[requeue] Nothing was changed.');
    return { blocked: blocked.length, releasing: [] };
  }

  const plan = planRequeue(blocked, args);
  console.log(`[requeue] ${plan.matched} job(s) match; releasing ${plan.releasing.length}, holding ${plan.held}, leaving ${plan.unmatched} blocked for other reasons.`);
  for(const job of plan.releasing) console.log(`[requeue]   ${job.id} · ${job.jobType} · ${job.candidateId || 'no candidate'}`);

  if(!args.apply){
    console.log('[requeue] Dry run. Nothing was changed. Re-run with --apply to release these.');
    return plan;
  }
  const fields = requeueFields(args.reason);
  await store.requeueBlockedJobsMatching(plan.releasing.map(job => job.id), fields);
  console.log(`[requeue] Released ${plan.releasing.length} job(s): ${fields.requeueReason}`);
  return plan;
}

if(require.main === module) main().catch(error => { console.error(`[requeue] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, main };
