#!/usr/bin/env node
'use strict';

/**
 * retire-blocked-jobs — clear blocked jobs from a lane that no longer runs.
 *
 *   npm run backoffice:retire-blocked-jobs -- --job-type hosted-editorial-publication
 *   npm run backoffice:retire-blocked-jobs -- --job-type hosted-editorial-publication --apply
 *
 * Without --apply it changes nothing and prints what it would do. Job types
 * must be named: the tool does not decide which lane is dead, and refuses the
 * two that carry trail verification even when they are named.
 *
 * Retiring marks a job completed with a recorded reason. Nothing is deleted,
 * so a mistake stays visible and reversible.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { PROTECTED_JOB_TYPES, planRetirement, retirementFields } = require('../workflows/retire-blocked-jobs');

function parseArgs(argv) {
  const jobTypes = [];
  let apply = false;
  let reason = 'lane no longer runs';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--job-type') { jobTypes.push(argv[index += 1]); continue; }
    if (arg === '--reason') { reason = argv[index += 1]; continue; }
    if (arg === '--apply') { apply = true; continue; }
  }
  return { jobTypes: jobTypes.filter(Boolean), apply, reason };
}

async function main(options = {}) {
  const { jobTypes, apply, reason } = parseArgs(options.argv || process.argv.slice(2));
  const store = options.store || new FirestoreBackofficeStore();

  if (!jobTypes.length) {
    // Show what is there rather than an empty usage line: the first question
    // is always "which lanes are even failing?".
    const blocked = (await store.listJobs(['blocked'])).filter(job => job.status === 'blocked');
    const counts = new Map();
    blocked.forEach(job => {
      const key = job.jobType || '(unknown)';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    console.log(`[retire] ${blocked.length} blocked job(s). Name a lane with --job-type:\n`);
    [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([jobType, count]) => {
      const guard = PROTECTED_JOB_TYPES.includes(jobType) ? '  (protected, cannot be retired)' : '';
      console.log(`  ${String(count).padStart(3)}  ${jobType}${guard}`);
    });
    console.log('\n[retire] Nothing was changed.');
    return { blocked: blocked.length, retired: 0 };
  }

  const jobs = await store.listJobs(['blocked']);
  const { retire, refused } = planRetirement(jobs, jobTypes);

  refused.forEach(jobType =>
    console.error(`[retire] Refusing "${jobType}": it carries trail verification, and retiring it would erase a real failure.`));

  if (!retire.length) {
    console.log('[retire] No blocked job matches those job types. Nothing was changed.');
    return { blocked: jobs.length, retired: 0, refused };
  }

  console.log(`[retire] ${retire.length} blocked job(s) would be retired:\n`);
  retire.slice(0, 20).forEach(job =>
    console.log(`  ${job.jobType}  ${job.id}\n      ${String(job.lastError || '(no error recorded)').slice(0, 110)}`));
  if (retire.length > 20) console.log(`  … and ${retire.length - 20} more`);

  if (!apply) {
    console.log('\n[retire] Nothing was changed. Re-run with --apply to retire them.');
    return { blocked: jobs.length, retired: 0, refused, wouldRetire: retire.length };
  }

  const at = new Date().toISOString();
  let retired = 0;
  for (const job of retire) {
    // completeSystemJob keeps the document and its history; nothing is deleted.
    await store.completeSystemJob(job.id, retirementFields(reason, at));
    retired += 1;
  }
  console.log(`\n[retire] Retired ${retired} job(s), recorded as "${reason}".`);
  return { blocked: jobs.length, retired, refused };
}

if (require.main === module) {
  main().catch(error => { console.error(`[retire] ${error.stack || error.message}`); process.exitCode = 1; });
}

module.exports = { main, parseArgs };
