'use strict';

/**
 * Survey a named trail again, because the surveyor got better.
 *
 * The geometry audit is deterministic and free -- no model call -- and it is
 * where the map reading lives. So every improvement to it is invisible to any
 * trail that has already been past it, and nothing in the pipeline ever goes
 * backwards.
 *
 * That cost three improvements their effect on 15 October 2026. The route
 * number sitting unread in a stored audit; the numbered routes running along a
 * walk that carries none; the mark that says somebody looked for them and found
 * none. Each one landed, and each one applied only to trails surveyed after it.
 * Five of the eight trails still blocked had moved past the survey and could
 * never benefit from a better one.
 *
 * This does the smallest thing that fixes that: it queues a fresh survey and
 * changes nothing else.
 *
 * It does not send the trail back a stage. `reconsider-rejected-trails` does,
 * and it is right to for a rejection, but it also sets `reconsideredAt` -- and
 * that marks *every* agent's evidence as predating the return, so a trail sent
 * back for a survey would stall at evidence-research waiting for research
 * nobody queued. Here the trail stays exactly where it is.
 *
 * It does not have to move, because every reader already takes the newest
 * completed output per agent. The new survey becomes the one the gate reads the
 * moment it lands, and the research already paid for is untouched.
 */

/** A trail named by either of its two ids, which are not always the same. */
function named(orchestration, ids){
  const wanted = new Set((ids || []).map(id => String(id).trim()).filter(Boolean));
  if(!wanted.size) return { trails: [], unknown: [] };
  const trails = (orchestration?.trails || []).filter(trail =>
    wanted.has(String(trail.trailId)) || wanted.has(String(trail.candidateId)));
  const found = new Set(trails.flatMap(trail => [String(trail.trailId), String(trail.candidateId)]));
  return { trails, unknown: [...wanted].filter(id => !found.has(id)) };
}

// A trail that has left the pipeline is not re-surveyed by this: `imported` and
// `rejected` are resting states, and a trail resting is not waiting for
// anything. `reconsider-rejected-trails` is the way back from a rejection,
// because that needs the stage reset this deliberately avoids.
const RESTING = Object.freeze(['imported', 'rejected']);

/**
 * What a re-survey would do, named trail by named trail, before it does it.
 *
 * A trail already at the survey has one queued or about to be; a second would
 * be two audits of the same line, so it is held and said so rather than
 * silently skipped.
 */
function planResurvey(orchestration, ids){
  const { trails, unknown } = named(orchestration, ids);
  const surveying = [];
  const resting = [];
  const queueing = [];
  for(const trail of trails){
    const entry = { trailId: trail.trailId, candidateId: trail.candidateId,
      trailName: trail.trailName || trail.trailId, state: trail.state };
    if(String(trail.state) === 'geometry-audit'){ surveying.push(entry); continue; }
    if(RESTING.includes(String(trail.state))){ resting.push(entry); continue; }
    queueing.push(entry);
  }
  return { queueing, surveying, resting, unknown };
}

/**
 * The trail with one more survey attempt on the clock.
 *
 * The attempt counter moves so the new job is a new attempt rather than a
 * replay of the one before it -- the id is built from the count, and a repeat
 * would collide with the job already stored.
 */
function withAnotherSurvey(trail, jobId) {
  const attempts = { ...(trail.attempts || {}) };
  attempts.cartographer = Number(attempts.cartographer || 0) + 1;
  return { ...trail, attempts, jobIds: [...(trail.jobIds || []), jobId] };
}

function surveyAttempt(trail){
  return Number((trail.attempts || {}).cartographer || 0) + 1;
}

module.exports = { RESTING, named, planResurvey, withAnotherSurvey, surveyAttempt };
