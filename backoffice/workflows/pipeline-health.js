'use strict';

/**
 * What the pipeline is doing, and where it has stopped.
 *
 * The desk could read `backofficeJobs` directly -- moderators are allowed to --
 * but it polls once a minute and there are hundreds of jobs, which is tens of
 * thousands of document reads a day against a 50K free-tier quota. So the
 * worker, which already lists every job on each pass, summarises them into one
 * artifact and the desk reads that: one document instead of a hundred.
 *
 * The summary answers two questions and no others:
 *   - is anything moving?
 *   - what has stopped, and will it start again on its own?
 *
 * That second question is the whole point. A blocked job whose error is a
 * provider outage is requeued automatically by the worker, so it needs no
 * decision and reporting it as a failure sends someone chasing a fault that
 * does not exist. A job blocked for a reason of its own never restarts by
 * itself. Those look identical in a count of "blocked".
 *
 * Two conditions, not one. requeueOutageBlockedJobs also filters on the lanes
 * the worker still processes, so an outage-blocked job in a retired lane is
 * never put back: the first live run of this summary reported 34 such jobs as
 * "start again on their own once the cause clears" when the lane that ran them
 * had been deleted, which is exactly the false reassurance the split exists to
 * prevent. A lane with no processor is a lane to retire, whatever its error
 * says.
 */

const { providerOutage } = require('../services/provider-outage');
const { PROTECTED_JOB_TYPES } = require('./retire-blocked-jobs');

/**
 * Plain-language causes. The patterns are narrower than provider-outage.js on
 * purpose: that module answers "should this count against the job", this one
 * answers "what would a person do about it", and billing and a 500 from the
 * provider have the same answer to the first question and different answers to
 * the second.
 */
const CAUSES = Object.freeze([
  {
    id: 'billing',
    match: /\bno credits remaining\b|\binsufficient[_ ]quota\b|\bexceeded your current quota\b|\bbilling\b/i,
    message: 'The model provider will not accept calls: the account is out of credit.',
    remedy: 'Add credit to the provider account. Nothing of this kind runs until then.',
  },
  {
    id: 'rate-limit',
    match: /request failed \(429\)|\btoo many requests\b|\brate limit\b/i,
    message: 'The provider refused the call for asking too often.',
    remedy: 'Nothing to do. The automation spaces the retries out by itself.',
  },
  {
    id: 'provider-down',
    match: /request failed \(5\d\d\)|\b(UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED)\b|\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network error|fetch failed)\b/i,
    message: 'The call never reached the provider, or the provider failed it.',
    remedy: 'Nothing to do. The automation puts these back by itself.',
  },
  {
    // The single largest ceiling on the catalogue, and the one failure here
    // that a person can actually clear: no amount of retrying invents a source
    // that does not exist, so it must not read like a transient fault.
    id: 'route-guidance',
    match: /route-source-identity|authoritative route guidance|route-number-(status|sequence|switches)|recommended-start/i,
    message: 'No authoritative source says where this walk starts or which way it goes.',
    remedy: 'Add the official route sheet for the trail -- a comune or department fiche naming the start and the order of the route. Retrying cannot invent one.',
  },
  {
    id: 'missing-tool',
    match: /\bENOENT\b|\bspawn\b.*\bENOENT\b|command not found/i,
    message: 'It tried to run a program that is not installed on the machine.',
    remedy: 'Install the program on the machine that runs it, or stop this kind of work if it is no longer wanted.',
  },
]);

function causeOf(error) {
  const text = String(error || '').trim();
  if (!text) return { id: 'unrecorded', message: 'The job failed without recording an error.', remedy: 'Run it once by hand to see what it says.' };
  const known = CAUSES.find(candidate => candidate.match.test(text));
  if (known) return { id: known.id, message: known.message, remedy: known.remedy };
  return {
    id: 'fault',
    // The raw text is the only thing that distinguishes one fault from another,
    // so it is kept, trimmed rather than replaced by a category.
    message: text.replace(/\s+/g, ' ').slice(0, 160),
    remedy: 'This is a fault in the work itself. It will not clear on its own.',
  };
}

/** Whatever shape a timestamp arrived in, as a Date or null. */
function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function span(dates) {
  const times = dates.map(asDate).filter(Boolean).sort((a, b) => a - b);
  if (!times.length) return { oldest: null, newest: null };
  return { oldest: times[0].toISOString(), newest: times[times.length - 1].toISOString() };
}

const MAX_LANES = 12;
const MAX_CAUSES = 3;

/**
 * One row per lane that has stopped work, plus the totals for everything still
 * moving. Pure, so the artifact the worker writes and the tests are reading the
 * same function.
 */
function summarisePipeline(jobs, options = {}) {
  const all = Array.isArray(jobs) ? jobs : [];
  const at = options.at || new Date().toISOString();
  const count = status => all.filter(job => job.status === status).length;
  const stopped = all.filter(job => job.status === 'blocked');

  // The lanes the worker still runs. The caller passes its own list rather
  // than this module importing it, because the worker imports this module and
  // the cycle would be worse than the argument. Absent, no lane is claimed to
  // be live: over-reporting work as retired is recoverable, promising a
  // restart that never comes is not.
  const live = new Set(Array.isArray(options.processableJobTypes) ? options.processableJobTypes.map(String) : []);
  const laneRuns = jobType => live.has(String(jobType));

  // The worker's own rule, not a second opinion: requeueOutageBlockedJobs puts
  // back exactly the jobs that pass both of these, so the desk must too.
  const resumes = job => providerOutage(job.lastError) && laneRuns(job.jobType);

  const byLane = new Map();
  all.forEach(job => {
    const jobType = String(job.jobType || '(unnamed lane)');
    if (!byLane.has(jobType)) byLane.set(jobType, []);
    byLane.get(jobType).push(job);
  });

  const lanes = [...byLane.entries()]
    .map(([jobType, laneJobs]) => {
      const laneStopped = laneJobs.filter(job => job.status === 'blocked');
      const causes = new Map();
      laneStopped.forEach(job => {
        const cause = causeOf(job.lastError);
        const key = `${cause.id}:${cause.message}`;
        if (!causes.has(key)) causes.set(key, { ...cause, count: 0, resumesItself: resumes(job) });
        causes.get(key).count += 1;
      });
      return {
        jobType,
        // Retiring one of these would drop a trail out of verification, so the
        // desk must not offer a stop button for it.
        carriesVerification: PROTECTED_JOB_TYPES.includes(jobType),
        // No processor left. Its jobs cannot succeed, cannot be requeued, and
        // are only counting themselves among the live failures.
        laneRetired: !laneRuns(jobType),
        queued: laneJobs.filter(job => job.status === 'queued').length,
        running: laneJobs.filter(job => job.status === 'running').length,
        readyForReview: laneJobs.filter(job => job.status === 'ready-for-review').length,
        stopped: laneStopped.length,
        resumesItself: laneStopped.filter(resumes).length,
        needsDecision: laneStopped.filter(job => !resumes(job)).length,
        ...span(laneStopped.map(job => job.updatedAt || job.createdAt)),
        causes: [...causes.values()].sort((a, b) => b.count - a.count).slice(0, MAX_CAUSES),
      };
    })
    .filter(lane => lane.stopped || lane.queued || lane.running || lane.readyForReview)
    .sort((a, b) => b.needsDecision - a.needsDecision || b.stopped - a.stopped || b.queued - a.queued)
    .slice(0, MAX_LANES);

  return {
    contractVersion: '1.0.0',
    generatedAt: at,
    working: {
      queued: count('queued'),
      running: count('running'),
      readyForReview: count('ready-for-review'),
    },
    stopped: {
      total: stopped.length,
      resumesItself: stopped.filter(resumes).length,
      needsDecision: stopped.filter(job => !resumes(job)).length,
      ...span(stopped.map(job => job.updatedAt || job.createdAt)),
    },
    lanes,
  };
}

module.exports = { CAUSES, causeOf, summarisePipeline };
