'use strict';

/**
 * Retiring blocked jobs from a lane that no longer runs.
 *
 * A job that spent its full retry budget stays `blocked` for ever. That is
 * correct while the lane still runs: the failure is a fault to fix. It stops
 * being correct once the lane is parked or removed, because the job is then
 * failing against code that no longer exists, and it keeps counting itself
 * among the live failures. On 2026-09-07, 15 of 88 blocked jobs were of that
 * kind, and they hid the four that mattered.
 *
 * The tool will not decide which lane is dead. That is a judgement about the
 * product, so the caller names the job types explicitly and this module only
 * enforces that the naming is safe.
 */

/**
 * Job types that carry trail verification. Retiring one of these would erase
 * a real failure and quietly drop a trail out of the pipeline, so they are
 * refused even when named directly.
 */
const PROTECTED_JOB_TYPES = Object.freeze([
  'trail-verification-specialist',
  'trail-claim-resolution',
]);

function isProtected(jobType) {
  return PROTECTED_JOB_TYPES.includes(String(jobType));
}

/**
 * Decide what a run would do. Pure, so the dry run and the apply cannot
 * disagree: both read this and nothing else.
 */
function planRetirement(jobs, jobTypes) {
  const wanted = new Set((jobTypes || []).map(String));
  const refused = [...wanted].filter(isProtected);
  const selectable = [...wanted].filter(jobType => !isProtected(jobType));

  const retire = [];
  const skipped = [];
  (jobs || []).forEach(job => {
    if (job.status !== 'blocked') return;               // only spent jobs
    const jobType = String(job.jobType || '');
    if (!wanted.has(jobType)) return;                   // not named by the caller
    if (isProtected(jobType)) {
      skipped.push({ id: job.id, jobType, reason: 'carries trail verification' });
      return;
    }
    retire.push({ id: job.id, jobType, agentId: job.agentId || null, lastError: job.lastError || null });
  });

  return { retire, skipped, refused, selectable };
}

/** The record left on a retired job, so the reason survives the action. */
function retirementFields(reason, at) {
  return {
    retiredReason: String(reason || 'lane no longer runs'),
    retiredAt: at,
    retiredFrom: 'blocked',
  };
}

module.exports = { PROTECTED_JOB_TYPES, isProtected, planRetirement, retirementFields };
