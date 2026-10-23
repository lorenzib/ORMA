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

/**
 * The walks surveyed before the surveyor learned to record what it found.
 *
 * Naming them by hand was the only way to ask for a re-survey, and a list
 * typed from a report is a list that is wrong the next morning. This asks the
 * record instead.
 *
 * A survey taken since 15 October carries one of three marks, and which one it
 * carries is the answer: `routeGuidance` says the numbered routes along this
 * walk and their order, `routeNumbersAbsent` says somebody measured and there
 * are none, `routeNumbersUnmeasured` says the measurement could not be taken.
 * An older survey carries none of them, and a walk with none of them cannot be
 * told from a walk measured and found to carry nothing -- which is the one
 * distinction the record rung needs to answer `route-number-sequence` and
 * `route-number-switches` without paying an agent.
 *
 * Only the cartographer's own output is read, because only the cartographer
 * writes these. And only its newest: a trail re-surveyed once is current even
 * if the audit before it was not.
 */
const SURVEY_MARKS = Object.freeze(['routeGuidance', 'routeNumbersAbsent', 'routeNumbersUnmeasured']);

function timeOf(value){
  const parsed = Date.parse(typeof value === 'string' ? value : (value?.toDate?.().toISOString?.() || ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** The newest cartographer output for this trail, or null. */
function newestSurvey(outputs){
  let newest = null;
  for(const output of outputs || []){
    if(output?.agentId !== 'cartographer') continue;
    if(!newest || timeOf(output.completedAt || output.createdAt) >= timeOf(newest.completedAt || newest.createdAt)){
      newest = output;
    }
  }
  return newest;
}

/** Whether this survey says what it found when it looked for route numbers. */
function surveyRecordsWhatItFound(survey){
  const result = survey?.result;
  if(!result) return false;
  return SURVEY_MARKS.some(mark => result[mark] !== undefined && result[mark] !== null);
}

/**
 * Which trails a re-survey would be worth taking, asked of the record.
 *
 * A trail with no survey at all is not included: it has never been past the
 * cartographer, so there is nothing stale about it and a queued audit is
 * already owed. Saying "stale" of a walk nobody has surveyed would send a
 * second audit after the first.
 */
function surveyedBeforeTheMarks(orchestration, outputsByTrail){
  const stale = [];
  const current = [];
  const neverSurveyed = [];
  for(const trail of orchestration?.trails || []){
    if(RESTING.includes(String(trail.state))) continue;
    const key = String(trail.trailId || trail.candidateId);
    const survey = newestSurvey(outputsByTrail?.get?.(key) || outputsByTrail?.[key] || []);
    const entry = { trailId: trail.trailId, candidateId: trail.candidateId,
      trailName: trail.trailName || trail.trailId, state: trail.state };
    if(!survey){ neverSurveyed.push(entry); continue; }
    (surveyRecordsWhatItFound(survey) ? current : stale).push(entry);
  }
  return { stale, current, neverSurveyed };
}

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
// because that needs the stage reset this deliberately avoids. A walk verified
// by hand is changed by hand, so a pass does not re-measure it either.
const RESTING = Object.freeze(['imported', 'rejected', 'verified-by-hand']);

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

module.exports = { RESTING, SURVEY_MARKS, newestSurvey, surveyRecordsWhatItFound, surveyedBeforeTheMarks, named, planResurvey, withAnotherSurvey, surveyAttempt };
