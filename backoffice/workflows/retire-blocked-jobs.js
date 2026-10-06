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
 *
 * A queued job in such a lane is the same litter wearing a different label, and
 * it was invisible here because this only ever read blocked ones: ten queued
 * `hosted-image-sourcing` jobs sat in the pipeline long after the lane was
 * deleted, counted as work owed by every report. Queued is retirable only where
 * no processor exists for the lane — in a lane that still runs, a queued job is
 * someone's work and is never touched.
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
function planRetirement(jobs, jobTypes, options = {}) {
  const wanted = new Set((jobTypes || []).map(String));
  // Which lanes still have a processor. Without this the caller cannot know a
  // queued job is stranded rather than pending, so queued stays untouchable —
  // the safe default, and the one every existing caller gets.
  const liveLanes = options.liveJobTypes ? new Set(options.liveJobTypes.map(String)) : null;
  const refused = [...wanted].filter(isProtected);
  const selectable = [...wanted].filter(jobType => !isProtected(jobType));

  const retire = [];
  const skipped = [];
  (jobs || []).forEach(job => {
    const jobType = String(job.jobType || '');
    if (!wanted.has(jobType)) return;                   // not named by the caller
    if (isProtected(jobType)) {
      skipped.push({ id: job.id, jobType, reason: 'carries trail verification' });
      return;
    }
    const entry = { id: job.id, jobType, agentId: job.agentId || null, lastError: job.lastError || null };
    if (job.status === 'blocked') { retire.push({ ...entry, retiredFrom: 'blocked' }); return; }
    if (job.status !== 'queued') return;                // running or finished: not ours to touch
    if (!liveLanes) return;                             // caller cannot tell stranded from pending
    if (liveLanes.has(jobType)) {
      skipped.push({ id: job.id, jobType, reason: 'queued in a lane that still runs' });
      return;
    }
    retire.push({ ...entry, retiredFrom: 'queued' });
  });

  return { retire, skipped, refused, selectable };
}

/** The record left on a retired job, so the reason survives the action. */
function retirementFields(reason, at, from = 'blocked') {
  return {
    retiredReason: String(reason || 'lane no longer runs'),
    retiredAt: at,
    retiredFrom: from,
  };
}

module.exports = { PROTECTED_JOB_TYPES, isProtected, planRetirement, retirementFields };
