'use strict';

// A job blocked because the work was wrong stays blocked forever, which is
// right: retrying a fault reproduces it. But when the fault was ours and has
// been fixed, those jobs are the only ones that can prove it, and nothing could
// release them -- requeueOutageBlockedJobs only takes provider outages, and
// retire-blocked-jobs marks jobs completed rather than running them, and refuses
// the verification lanes anyway.
//
// Seven seasonal-restrictions jobs blocked against a rule the agent was never
// told, in run-trail-specialist.js. Fixing the instruction does nothing for them
// unless they run again.
//
// The caller names the error it believes it has fixed. There is no "requeue
// everything blocked": releasing jobs whose cause is still live spends the model
// budget to re-learn it, which is roughly how the backlog was built.

const { PROTECTED_JOB_TYPES } = require('./retire-blocked-jobs');

function matcher(pattern){
  if(pattern instanceof RegExp) return value => pattern.test(String(value || ''));
  const text = String(pattern || '').trim();
  if(!text) throw new Error('An error pattern is required: requeueing every blocked job re-runs faults that are still live');
  return value => String(value || '').includes(text);
}

/**
 * The jobs a release would touch, newest-blocked last so a bounded run takes the
 * oldest first. Pure, so the choice can be read and tested without a database.
 */
function planRequeue(jobs, options = {}){
  const matches = matcher(options.errorPattern);
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
  const jobTypes = Array.isArray(options.jobTypes) && options.jobTypes.length ? new Set(options.jobTypes) : null;
  const candidateId = String(options.candidateId || '').trim() || null;

  const blocked = (Array.isArray(jobs) ? jobs : []).filter(job => job && job.status === 'blocked');
  const selected = blocked
    .filter(job => matches(job.lastError))
    .filter(job => !jobTypes || jobTypes.has(job.jobType))
    .filter(job => !candidateId || job.candidateId === candidateId)
    .sort((left, right) => String(left.blockedAt || left.updatedAt || '').localeCompare(String(right.blockedAt || right.updatedAt || '')));

  return {
    matched: selected.length,
    // What a bounded pass will actually release this time.
    releasing: selected.slice(0, limit),
    held: Math.max(0, selected.length - limit),
    // Everything blocked for some other reason, which this release leaves alone.
    unmatched: blocked.length - selected.length,
  };
}

/**
 * A fresh budget: the previous failures were against a rule that has since
 * changed. lastError is kept, as requeueOutageBlockedJobs keeps it -- it is the
 * only record of why the job stalled, and the reports group by it.
 */
function requeueFields(reason, at){
  return {
    status: 'queued',
    systemFailures: 0,
    requeuedAt: at || new Date().toISOString(),
    requeueReason: String(reason || 'the cause was fixed').slice(0, 300),
  };
}

module.exports = { PROTECTED_JOB_TYPES, matcher, planRequeue, requeueFields };
