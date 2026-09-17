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
const TERMINAL = Object.freeze(['rejected', 'blocked']);

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

function buildFunnel({orchestration, jobs = [], reviewQueue, nowMs = Date.now()}){
  const trails = orchestration?.trails || [];
  const jobsByTrail = new Map();
  for(const job of jobs){
    if(!jobsByTrail.has(job.candidateId)) jobsByTrail.set(job.candidateId, []);
    jobsByTrail.get(job.candidateId).push(job);
  }

  const described = trails.map(trail => describeTrail(trail, jobsByTrail, nowMs));
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
  const dossierGate = {
    inState: atGate.length,
    // Reached it by completing a dossier, which is the only route that can be approved.
    genuine: atGate.filter(trail => trail.stage === REAL_GATE_STAGE).length,
    // Reached it by an agent job failing. Cannot be approved, only revised or rejected.
    viaAgentFailure: atGate.filter(trail => trail.stage === FAILURE_STAGE).length,
    approvableItemsInQueue: queueItems.filter(item => item.gateType === 'dossier-approval' && item.state === 'awaiting-human').length,
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
    // High attempt counts with no progress mean the loop is spending money
    // without converging, which reads as healthy work from every other angle.
    mostAttempts: [...described].sort((a, b) => b.attempts - a.attempts).slice(0, 8),
  };
}

module.exports = {FUNNEL, TERMINAL, REAL_GATE_STAGE, FAILURE_STAGE, attemptCount, buildFunnel, describeTrail, pendingJobs, stalled};
