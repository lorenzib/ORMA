'use strict';

// Cadence matches the worker cron: every 3 hours = 180 minutes (see
// .github/workflows/orma-backoffice-worker.yml, deliberately slowed to stay
// inside the Firestore free-tier quota). The health thresholds were left at the
// old 15-minute assumption, so every normal 3-hourly gap tripped "delayed" then
// "stale". Allow one interval plus GitHub scheduler jitter before "delayed", and
// a whole extra missed cycle before "stale", so only a genuine outage alarms.
const DEFAULT_EXPECTED_INTERVAL_MINUTES = 180;
const DEFAULT_DELAY_AFTER_MINUTES = 210;
const DEFAULT_STALE_AFTER_MINUTES = 390;

function text(value, maximum = 2000){
  return String(value || '').trim().slice(0, maximum);
}

function runIdentity(input = {}){
  return {
    runId:text(input.runId, 120) || null,
    runAttempt:input.runAttempt == null ? null : (Number.parseInt(input.runAttempt, 10) || 1),
    workflowRunUrl:text(input.workflowRunUrl, 1000) || null,
    eventName:text(input.eventName, 120) || null,
    branch:text(input.branch, 240) || null,
    commitSha:text(input.commitSha, 120) || null,
  };
}

// A run can finish every step it was given and still get nothing done. That is
// not a failure -- nothing crashed, the publication lanes are fine -- but it is
// not health either, and for five days in September 2026 it was reported as
// health. 'degraded' is the state for it.
const OUTCOMES = Object.freeze(['success', 'degraded', 'blocked', 'failure']);
const STATUS_BY_OUTCOME = Object.freeze({ success:'healthy', degraded:'degraded', blocked:'blocked', failure:'failed' });

function workReceipt(input = {}){
  const work=input.work;
  if(!work || !work.outcome) return null;
  return {
    outcome:text(work.outcome, 40),
    attempted:Number(work.attempted || 0),
    succeeded:Number(work.succeeded || 0),
    failed:Number(work.failed || 0),
    providerParked:Boolean(work.providerParked),
    message:text(work.message, 1200) || null,
  };
}

function beginWorkerRun(previous, input = {}, options = {}){
  const at=options.at || new Date().toISOString();
  const identity=runIdentity(input);
  return {
    contractVersion:'1.0.0',
    status:'running',
    ...identity,
    runAttempt:identity.runAttempt || 1,
    startedAt:at,
    completedAt:null,
    durationMs:null,
    expectedIntervalMinutes:DEFAULT_EXPECTED_INTERVAL_MINUTES,
    delayAfterMinutes:DEFAULT_DELAY_AFTER_MINUTES,
    staleAfterMinutes:DEFAULT_STALE_AFTER_MINUTES,
    lastSuccessfulAt:previous?.lastSuccessfulAt || null,
    lastFailedAt:previous?.lastFailedAt || null,
    lastBlockedAt:previous?.lastBlockedAt || null,
    consecutiveFailures:Number(previous?.consecutiveFailures || 0),
    lastFailure:previous?.lastFailure || null,
    lastProductiveAt:previous?.lastProductiveAt || null,
    consecutiveUnproductiveRuns:Number(previous?.consecutiveUnproductiveRuns || 0),
    lastUnproductive:previous?.lastUnproductive || null,
    publicationGate:previous?.publicationGate || null,
    recentRuns:[...(previous?.recentRuns || [])].slice(-19),
  };
}

function finishWorkerRun(current, input = {}, options = {}){
  const at=options.at || new Date().toISOString();
  const startedAt=current?.startedAt || input.startedAt || at;
  const durationMs=Math.max(0,new Date(at).getTime()-new Date(startedAt).getTime());
  const outcome=OUTCOMES.includes(input.outcome) ? input.outcome : 'failure';
  const work=workReceipt(input);
  const currentIdentity=runIdentity(current || {});const incomingIdentity=runIdentity(input);
  const identity={};
  for(const key of Object.keys(currentIdentity))identity[key]=incomingIdentity[key] == null ? currentIdentity[key] : incomingIdentity[key];
  identity.runAttempt=identity.runAttempt || 1;
  const failure=outcome === 'failure' ? {
    stage:text(input.failureStage || 'worker-execution', 160),
    message:text(input.failureMessage || 'The worker failed without a captured error message.'),
    failedAt:at,
    workflowRunUrl:identity.workflowRunUrl,
  } : null;
  const publicationGate=outcome === 'blocked' ? {
    stage:text(input.failureStage || 'website-publication-gate', 160),
    message:text(input.failureMessage || 'Website publication is paused until Validate ORMA passes.'),
    blockedAt:at,
    validationRunUrl:text(input.validationRunUrl,1000) || null,
    commitSha:identity.commitSha,
  } : null;
  // An idle run is evidence of neither productivity nor its absence, so it
  // leaves both counters exactly as it found them.
  const productive=work?.outcome === 'productive';
  const unproductive=outcome === 'degraded' || work?.outcome === 'unproductive';
  const lastUnproductive=unproductive ? {
    stage:text(input.failureStage || 'agent-work', 160),
    message:work?.message || text(input.failureMessage || 'Every job this run attempted failed.'),
    since:current?.lastUnproductive?.since || at,
    observedAt:at,
    attempted:work?.attempted ?? null,
    failed:work?.failed ?? null,
    providerParked:Boolean(work?.providerParked),
    workflowRunUrl:identity.workflowRunUrl,
  } : null;
  const receipt={
    ...identity,
    outcome,
    ...(work ? { work } : {}),
    startedAt,
    completedAt:at,
    durationMs,
    ...(failure ? { failureStage:failure.stage, failureMessage:failure.message } : {}),
    ...(publicationGate ? { blockedStage:publicationGate.stage, blockedMessage:publicationGate.message } : {}),
  };
  return {
    contractVersion:'1.0.0',
    status:STATUS_BY_OUTCOME[outcome],
    ...identity,
    startedAt,
    completedAt:at,
    durationMs,
    expectedIntervalMinutes:DEFAULT_EXPECTED_INTERVAL_MINUTES,
    delayAfterMinutes:DEFAULT_DELAY_AFTER_MINUTES,
    staleAfterMinutes:DEFAULT_STALE_AFTER_MINUTES,
    lastSuccessfulAt:outcome === 'success' ? at : (current?.lastSuccessfulAt || null),
    lastFailedAt:outcome === 'failure' ? at : (current?.lastFailedAt || null),
    lastBlockedAt:outcome === 'blocked' ? at : (current?.lastBlockedAt || null),
    consecutiveFailures:outcome === 'success' ? 0 : outcome === 'failure' ? Number(current?.consecutiveFailures || 0) + 1 : Number(current?.consecutiveFailures || 0),
    lastFailure:failure || current?.lastFailure || null,
    // Separate from lastSuccessfulAt on purpose: that one answers "did the
    // worker run", this one answers "did anything get done", and conflating
    // them is what made five days of refusals look like five days of health.
    lastProductiveAt:productive ? at : (current?.lastProductiveAt || null),
    consecutiveUnproductiveRuns:productive ? 0 : unproductive ? Number(current?.consecutiveUnproductiveRuns || 0) + 1 : Number(current?.consecutiveUnproductiveRuns || 0),
    lastUnproductive:productive ? null : (lastUnproductive || current?.lastUnproductive || null),
    publicationGate:publicationGate || (['success','degraded'].includes(outcome) ? null : current?.publicationGate || null),
    recentRuns:[...(current?.recentRuns || []),receipt].slice(-20),
  };
}

module.exports={
  DEFAULT_EXPECTED_INTERVAL_MINUTES,DEFAULT_DELAY_AFTER_MINUTES,DEFAULT_STALE_AFTER_MINUTES,OUTCOMES,STATUS_BY_OUTCOME,
  beginWorkerRun,finishWorkerRun,runIdentity,workReceipt,
};
