'use strict';

/**
 * Trail requests: a moderator asking the pipeline to do something for one
 * trail, from the trail board.
 *
 * Every action here is an existing lever that could only be pulled from the
 * GitHub Actions page, by typing trail ids into a workflow form. Nothing new
 * happens to a trail; what changes is who can ask and how. So each action maps
 * onto one workflow input that already exists and is already tested, and the
 * request processor only ever *dispatches* those workflows. It never writes
 * the orchestration itself, which keeps it out of the race the worker and the
 * requeue job already settle between them with their own concurrency groups.
 *
 * None of these decides a verification. The evidence policy still settles
 * every gate; a request only changes what is worked on, and when.
 */

const ACTIONS = Object.freeze({
  start: {
    label: 'Start verification',
    help: 'Admits it now instead of waiting for the daily intake.',
    workflow: 'worker', input: 'reverify_trail_ids',
  },
  prioritise: {
    label: 'Work on this next',
    help: 'Runs a worker pass for this trail only.',
    workflow: 'worker', input: 'candidate_id',
  },
  resurvey: {
    label: 'Re-measure the route',
    help: 'Takes the map survey again. Free: no AI credits. The trail stays where it is.',
    workflow: 'requeue', input: 'resurvey_trail_ids',
  },
  'retry-publication': {
    label: 'Retry publishing',
    help: 'Retries a failed publication before its cooldown ends. Use once the cause is fixed.',
    workflow: 'worker', input: 'force_publication_retry',
  },
  reconsider: {
    label: 'Look at it again',
    help: 'Returns a rejected trail to the agent that rejected it. Use when the cause is fixed or a new source exists.',
    workflow: 'requeue', input: 'reconsider_trail_ids',
  },
});

const WORKFLOW_FILES = Object.freeze({
  worker: 'orma-backoffice-worker.yml',
  requeue: 'orma-requeue-fixed-jobs.yml',
});

const ROUTE_STATES = new Set(['geometry-audit', 'geometry-human-gate']);
const RESEARCH_STATES = new Set(['evidence-research', 'evidence-resolution', 'provenance-audit', 'red-team', 'dossier-human-gate']);
// The worker admits at most this many named trails in one pass
// (start-live-trail-campaign MAX_NAMED_ADMISSIONS); asking for more in one
// dispatch would silently drop the rest.
const MAX_NAMED_ADMISSIONS = 5;
const MAX_IDS_PER_DISPATCH = 10;

/**
 * The actions a trail can take, from what the board knows about it. The page
 * renders exactly this list, and the processor checks a request against it
 * again, so a stale page cannot ask for something the trail can no longer do.
 */
function actionsFor(entry){
  if(!entry) return [];
  const out = [];
  const state = entry.state || null;
  if(!entry.inPipeline && entry.stage === 'queued') out.push('start');
  if(state && (ROUTE_STATES.has(state) || RESEARCH_STATES.has(state)) && entry.jobOwed) out.push('prioritise');
  if(entry.publicationFailed) out.push('retry-publication');
  if(state === 'rejected') out.push('reconsider');
  // planResurvey holds a trail already at the survey and skips a resting one.
  if(entry.inPipeline && state && state !== 'geometry-audit' && state !== 'imported') out.push('resurvey');
  return out;
}

function clean(id){ return String(id || '').trim(); }

/**
 * What one pass of the processor does with the requests waiting.
 *
 * At most one dispatch per workflow per pass. GitHub keeps one running and one
 * pending run per concurrency group and cancels an older pending run for a
 * newer one, so two dispatches of the same workflow in one pass could cancel
 * each other; one combined dispatch cannot. Whatever does not fit waits for the
 * next pass, fifteen minutes later.
 */
function planRequestPass({ queued = [], board = null } = {}){
  const entries = new Map((board?.trails || []).map(entry => [entry.id, entry]));
  const refused = [];
  const waiting = [];
  const worker = { reverify: [], candidate: null, forceRetry: false, requests: [] };
  const requeue = { resurvey: [], reconsider: [], requests: [] };
  const ordered = [...queued].sort((a, b) => String(a.submittedAt || '').localeCompare(String(b.submittedAt || '')));
  const seen = new Set();
  for(const request of ordered){
    const trailId = clean(request.trailId);
    const action = clean(request.action);
    const key = `${action}:${trailId}`;
    if(!ACTIONS[action]){ refused.push({ request, reason: 'unknown action' }); continue; }
    const entry = entries.get(trailId);
    if(!entry){ refused.push({ request, reason: 'not in the catalogue' }); continue; }
    if(!actionsFor(entry).includes(action)){
      refused.push({ request, reason: `not available while the trail is ${entry.stageLabel || entry.stage}` });
      continue;
    }
    // The same ask twice is one ask; the duplicate is answered with the first.
    if(seen.has(key)){ refused.push({ request, reason: 'already requested', duplicate: true }); continue; }
    seen.add(key);
    if(action === 'start'){
      if(worker.reverify.length >= MAX_NAMED_ADMISSIONS){ waiting.push(request); continue; }
      worker.reverify.push(trailId); worker.requests.push(request);
    }else if(action === 'prioritise'){
      if(worker.candidate){ waiting.push(request); continue; }
      worker.candidate = trailId; worker.requests.push(request);
    }else if(action === 'retry-publication'){
      worker.forceRetry = true; worker.requests.push(request);
    }else if(action === 'resurvey'){
      if(requeue.resurvey.length >= MAX_IDS_PER_DISPATCH){ waiting.push(request); continue; }
      requeue.resurvey.push(trailId); requeue.requests.push(request);
    }else if(action === 'reconsider'){
      if(requeue.reconsider.length >= MAX_IDS_PER_DISPATCH){ waiting.push(request); continue; }
      requeue.reconsider.push(trailId); requeue.requests.push(request);
    }
  }
  const dispatches = [];
  if(worker.requests.length){
    const inputs = {};
    if(worker.reverify.length) inputs.reverify_trail_ids = worker.reverify.join(',');
    if(worker.candidate) inputs.candidate_id = worker.candidate;
    if(worker.forceRetry) inputs.force_publication_retry = 'true';
    dispatches.push({ workflow: 'worker', file: WORKFLOW_FILES.worker, inputs, requests: worker.requests });
  }
  if(requeue.requests.length){
    const inputs = { apply: 'true', reason: 'requested from the trail board' };
    if(requeue.resurvey.length) inputs.resurvey_trail_ids = requeue.resurvey.join(',');
    if(requeue.reconsider.length) inputs.reconsider_trail_ids = requeue.reconsider.join(',');
    dispatches.push({ workflow: 'requeue', file: WORKFLOW_FILES.requeue, inputs, requests: requeue.requests });
  }
  return { dispatches, refused, waiting };
}

/**
 * The run a dispatch created. `gh workflow run` does not return one, so it is
 * the first run of that workflow, started by a dispatch, created at or after
 * the moment we dispatched. The processor runs one pass at a time, so nothing
 * else of ours can have dispatched that workflow in between.
 */
function runForDispatch(runs, dispatchedAt){
  const since = new Date(dispatchedAt).getTime() - 5000;
  return [...(runs || [])]
    .filter(run => run.event === 'workflow_dispatch' && new Date(run.createdAt).getTime() >= since)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0] || null;
}

/**
 * Where a dispatched request stands, from its run.
 *
 * A cancelled run is not a refusal: a newer pending run in the same group
 * replaced it, so the request goes back to the queue rather than being
 * reported as done. A run that has not appeared after an hour is treated the
 * same way, so a lost dispatch cannot strand a request.
 */
function settleDispatched(request, run, now){
  if(!run){
    const age = new Date(now).getTime() - new Date(request.dispatchedAt || 0).getTime();
    return age > 60 * 60 * 1000 ? { status: 'queued', note: 'The run never started; asked again.' } : null;
  }
  const base = { runId: String(run.databaseId || run.id || ''), runUrl: run.url || null };
  if(run.status !== 'completed') return { status: 'dispatched', ...base, unchanged: true };
  if(run.conclusion === 'success') return { status: 'done', ...base, note: 'The run finished.' };
  if(run.conclusion === 'cancelled') return { status: 'queued', ...base, note: 'The run was replaced by another one; asked again.' };
  return { status: 'failed', ...base, note: `The run ended: ${run.conclusion}.` };
}

module.exports = {
  ACTIONS, WORKFLOW_FILES, ROUTE_STATES, RESEARCH_STATES, MAX_NAMED_ADMISSIONS, MAX_IDS_PER_DISPATCH,
  actionsFor, planRequestPass, runForDispatch, settleDispatched,
};
