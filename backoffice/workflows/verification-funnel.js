'use strict';

// Zero trails are ORMA Verified after 86 moderator decisions, and the September
// credit outage explains five days of that, not the months before it. The
// per-state counts the desk shows cannot tell the difference between a trail
// being worked on and a trail parked in a state with nothing left to run, so
// this measures the funnel itself: where trails stop, how long they have been
// stopped, and whether anything is still owed to them.

// Pipeline order, not the contract's declaration order: a funnel is only
// readable if the stages are in the sequence trails actually travel.
const FUNNEL = Object.freeze([
  'geometry-audit', 'geometry-human-gate', 'evidence-research', 'evidence-resolution',
  'provenance-audit', 'red-team', 'dossier-human-gate', 'ready-for-editorial',
]);
const TERMINAL = Object.freeze(['imported', 'rejected', 'blocked']);

// A trail lands in dossier-human-gate two ways: from red-team with a real
// dossier to approve, or by an agent job failing anywhere downstream of the
// cartographer. Only the first can ever be approved -- the failure route offers
// request-revision and reject and nothing else -- so counting them together
// reports a trail at the finish line that cannot cross it.
const REAL_GATE_STAGE = 'complete-evidence-dossier';
const FAILURE_STAGE = 'agent-execution-failure';

// A trail in this stage was standing at the dossier gate and was pulled back
// out of it: when the required route-guidance claim set changes, the gate item
// is deleted and the trail is returned to evidence-research to re-earn it. So
// its presence is proof the trail did reach the finish line, which no snapshot
// of the current states can otherwise show.
const PULLED_BACK_STAGE = 'logistics-contract-refresh';

function timeValue(value){
  if(!value) return null;
  if(typeof value.toDate === 'function') return value.toDate().getTime();
  if(value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function daysSince(value, nowMs){
  const at = timeValue(value);
  return at === null ? null : Math.floor((nowMs - at) / 86400000);
}

function tally(list, pick){
  const counts = new Map();
  for(const item of list){
    const key = pick(item);
    if(key == null) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Total work attempted on a trail, across every agent and every resolution. */
function attemptCount(trail){
  const sum = record => Object.values(record || {}).reduce((total, value) => total + (Number(value) || 0), 0);
  return sum(trail.attempts) + sum(trail.resolutionAttempts);
}

/**
 * A trail is owed work if any job it references is still queued or running.
 * One that is owed nothing and is not at a human gate has nobody coming for
 * it: it is not slow, it is stopped, and no amount of provider credit moves it.
 */
function pendingJobs(trail, jobsByTrail){
  return (jobsByTrail.get(trail.candidateId) || []).filter(job => ['queued', 'running'].includes(job.status));
}

function stalled(trail, jobsByTrail){
  if(trail.state.endsWith('human-gate')) return false;
  if(TERMINAL.includes(trail.state)) return false;
  return pendingJobs(trail, jobsByTrail).length === 0;
}

function describeTrail(trail, jobsByTrail, nowMs){
  const pending = pendingJobs(trail, jobsByTrail);
  return {
    trailId: trail.trailId,
    candidateId: trail.candidateId,
    state: trail.state,
    stage: trail.stage || null,
    daysInState: daysSince(trail.updatedAt, nowMs),
    attempts: attemptCount(trail),
    pendingJobs: pending.length,
    stalled: stalled(trail, jobsByTrail),
    blockers: (trail.blockers || []).slice(0, 3),
  };
}

function buildFunnel({orchestration, jobs = [], reviewQueue,
  editorialQueue, publicationStaging, publicationRequests, overrides,
  nowMs = Date.now()}){
  const trails = orchestration?.trails || [];
  const jobsByTrail = new Map();
  for(const job of jobs){
    if(!jobsByTrail.has(job.candidateId)) jobsByTrail.set(job.candidateId, []);
    jobsByTrail.get(job.candidateId).push(job);
  }

  const described = trails.map(trail => describeTrail(trail, jobsByTrail, nowMs));
  const publication = [editorialQueue, publicationStaging, publicationRequests, overrides]
    .some(Boolean) ? publicationLeg({editorialQueue, publicationStaging, publicationRequests, overrides}) : null;
  const byState = new Map(described.map(trail => [trail.state, []]));
  for(const trail of described) byState.get(trail.state).push(trail);

  const stages = [...FUNNEL, ...TERMINAL].map(state => {
    const here = byState.get(state) || [];
    const dwell = here.map(trail => trail.daysInState).filter(days => days !== null);
    return {
      state,
      trails: here.length,
      stalled: here.filter(trail => trail.stalled).length,
      oldestDaysInState: dwell.length ? Math.max(...dwell) : null,
      medianDaysInState: dwell.length ? dwell.sort((a, b) => a - b)[Math.floor(dwell.length / 2)] : null,
    };
  });

  // The question the state counts cannot answer on their own.
  const atGate = byState.get('dossier-human-gate') || [];
  const queueItems = reviewQueue?.items || [];
  const dossierItems = queueItems.filter(item =>
    item.gateType === 'dossier-approval' && item.state === 'awaiting-human');
  const dossierGate = {
    inState: atGate.length,
    // Reached it by completing a dossier, which is the only route that can be approved.
    genuine: atGate.filter(trail => trail.stage === REAL_GATE_STAGE).length,
    // Reached it by an agent job failing. Cannot be approved, only revised or rejected.
    viaAgentFailure: atGate.filter(trail => trail.stage === FAILURE_STAGE).length,
    // Two different numbers, and the difference is the whole point. Being on
    // the desk means a human has to look; being approvable means the machine
    // already believes it is clean. This was one field called
    // approvableItemsInQueue that only ever counted the first, so a desk
    // holding two dossiers with unresolved blockers read as two decisions
    // ready to approve -- and the state report, which does check
    // approvalAllowed, disagreed with it on the same data.
    itemsOnDesk: dossierItems.length,
    readyToApprove: dossierItems.filter(item => item.approvalAllowed === true).length,
    // Current occupancy only. This artifact keeps no history, so it can say
    // what is in red-team now and must not be read as what ever was.
    inRedTeamNow: (byState.get('red-team') || []).length,
    // The one piece of past this snapshot does carry.
    pulledBackFromGate: described.filter(trail => trail.stage === PULLED_BACK_STAGE).length,
  };

  const stalledTrails = described.filter(trail => trail.stalled)
    .sort((a, b) => (b.daysInState ?? -1) - (a.daysInState ?? -1));

  return {
    generatedAt: new Date(nowMs).toISOString(),
    totalTrails: trails.length,
    stages,
    dossierGate,
    stalled: {
      total: stalledTrails.length,
      byState: tally(stalledTrails, trail => trail.state),
      // Named, because a stalled trail needs a person to look at it by hand.
      sample: stalledTrails.slice(0, 12),
    },
    // A terminal state is a dead end, and `stalled` cannot cover it: stalled()
    // returns false for TERMINAL by design, so a blocked trail is the one kind
    // that gets counted and never named. "blocked 1 · oldest 47d" was true for
    // seven weeks and told nobody which trail or why.
    terminal: TERMINAL.flatMap(state => (byState.get(state) || [])
      .sort((a, b) => (b.daysInState ?? -1) - (a.daysInState ?? -1))),
    // High attempt counts with no progress mean the loop is spending money
    // without converging, which reads as healthy work from every other angle.
    mostAttempts: [...described].sort((a, b) => b.attempts - a.attempts).slice(0, 8),
    // Past the gate. Absent rather than empty when the caller passed none of
    // the publication artifacts, because a leg reporting zero of everything
    // and a leg nobody asked for must not read the same.
    ...(publication ? {publication} : {}),
  };
}

/**
 * The half of the lane the funnel could not see.
 *
 * `ready-for-editorial` was the last stage it knew, and for a long time that
 * was honest: no trail had ever gone further, and everything past it was
 * theory. It is not theory now. A verified walk goes on to an editorial queue,
 * to publication staging, to an approved publication request, and into the
 * override file the site is built from -- four more places a trail can stop,
 * none of them reported.
 *
 * That matters most where it is quietest. A run that produces nothing reports
 * success, and the deadlock this leg exists to surface was exactly that shape:
 * 23 trails waiting on an approval nothing could ever give, in a state whose
 * name reads as patience. Nothing anywhere said so, because nothing looked.
 *
 * Read-only, from artifacts the system already writes, so it costs nothing.
 */
const PUBLICATION_LEG = Object.freeze([
  'editorial-queue', 'publication-staging', 'publication-requested', 'published',
]);

/** Everything holding this staging item, said as the item says it. */
function publicationHolds(item) {
  return [...(item?.missingApprovals || []), ...(item?.publicationMappingBlockers || [])];
}

/**
 * Where each trail past the gate has got to, and what is holding it.
 *
 * A trail is reported at the furthest place it has reached, because that is
 * the question being asked -- "how far did it get" -- and counting it in every
 * artifact it still appears in would make the leg add up to more trails than
 * exist.
 */
function publicationLeg({editorialQueue, publicationStaging, publicationRequests, overrides} = {}) {
  // Only the entries this pipeline wrote. The override file also holds
  // hand-written corrections -- a route shape somebody declared, a start point
  // sourced by hand -- and counting those as trails the lane published
  // overstated it by eight on the day this was written: eleven entries, three
  // publications. The materializer stamps every entry it writes with the
  // approval it came from, and nothing else has one.
  const published = new Map((overrides?.trails || [])
    .filter(entry => entry && typeof entry.id === 'string' && entry.approvalId)
    .map(entry => [String(entry.candidateId || entry.id), entry]));
  // Directions on a page, however they got there: the lane puts them there now,
  // and two walks were given them by hand before it could.
  const directionsOnThePage = (overrides?.trails || [])
    .filter(entry => entry?.fields?.routeNumberGuidance).length;
  const requested = new Map((publicationRequests?.requests || [])
    .filter(request => request && request.candidateId)
    .map(request => [String(request.candidateId), request]));
  const staged = new Map((publicationStaging?.items || [])
    .filter(item => item && item.candidateId)
    .map(item => [String(item.candidateId), item]));

  const where = new Map();
  for(const item of editorialQueue?.items || []){
    const id = String(item.candidateId);
    where.set(id, {candidateId: id, trailName: item.trailName || id, at: 'editorial-queue',
      holds: [
        ...(item.copyPolicy === 'preserve-existing' ? [] : ['copy not drafted']),
        ...(item.assetPolicy === 'preserve-existing' ? [] : ['image not sourced']),
      ]});
  }
  for(const [id, item] of staged){
    const holds = publicationHolds(item);
    where.set(id, {candidateId: id, trailName: where.get(id)?.trailName || id,
      at: 'publication-staging', state: item.state, holds});
  }
  for(const [id, request] of requested){
    where.set(id, {candidateId: id, trailName: where.get(id)?.trailName || id,
      at: 'publication-requested', state: request.status,
      holds: request.status === 'publication-failed' ? [request.failure?.message || 'publication failed'] : []});
  }
  for(const [id, entry] of published){
    const graduation = entry.fields?.graduation;
    where.set(id, {candidateId: id, trailName: where.get(id)?.trailName || entry.id,
      at: 'published', holds: [],
      // What the page it reached actually says, which is the only claim that
      // matters once a trail is out: the seal, or reviewed and how far along.
      seal: entry.fields?.ormaVerified === true ? 'verified' : 'reviewed',
      checks: graduation ? `${(graduation.completed || []).length} of ${(graduation.required || []).length}` : null,
      directions: Boolean(entry.fields?.routeNumberGuidance)});
  }

  const rows = [...where.values()];
  const stages = PUBLICATION_LEG.map(stage => {
    const here = rows.filter(row => row.at === stage);
    return {stage, trails: here.length, held: here.filter(row => row.holds.length).length};
  });
  const held = rows.filter(row => row.holds.length)
    .sort((a, b) => b.holds.length - a.holds.length);
  return {
    stages,
    // Published by this lane, which is the question being asked of it.
    reachedThePage: rows.filter(row => row.at === 'published').length,
    sealed: rows.filter(row => row.seal === 'verified').length,
    // Every walk in the override file whose page carries directions, by any
    // route -- a wider number than the one above, and said separately rather
    // than folded into it.
    directionsOnThePage,
    // Named, not counted: a held trail needs somebody to read the reason.
    held: held.slice(0, 20),
    // One line per distinct reason, because twenty trails held by one cause
    // and twenty held by twenty causes are different problems.
    heldBy: tally(held.flatMap(row => row.holds), reason => reason),
  };
}

module.exports = {FUNNEL, TERMINAL, PUBLICATION_LEG, REAL_GATE_STAGE, FAILURE_STAGE, attemptCount, buildFunnel, describeTrail, pendingJobs, publicationHolds, publicationLeg, stalled};
