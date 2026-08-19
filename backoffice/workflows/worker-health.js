'use strict';

const DEFAULT_EXPECTED_INTERVAL_MINUTES = 5;
const DEFAULT_DELAY_AFTER_MINUTES = 15;
const DEFAULT_STALE_AFTER_MINUTES = 30;

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
    expectedIntervalMinutes:previous?.expectedIntervalMinutes || DEFAULT_EXPECTED_INTERVAL_MINUTES,
    delayAfterMinutes:previous?.delayAfterMinutes || DEFAULT_DELAY_AFTER_MINUTES,
    staleAfterMinutes:previous?.staleAfterMinutes || DEFAULT_STALE_AFTER_MINUTES,
    lastSuccessfulAt:previous?.lastSuccessfulAt || null,
    lastFailedAt:previous?.lastFailedAt || null,
    consecutiveFailures:Number(previous?.consecutiveFailures || 0),
    lastFailure:previous?.lastFailure || null,
    recentRuns:[...(previous?.recentRuns || [])].slice(-19),
  };
}

function finishWorkerRun(current, input = {}, options = {}){
  const at=options.at || new Date().toISOString();
  const startedAt=current?.startedAt || input.startedAt || at;
  const durationMs=Math.max(0,new Date(at).getTime()-new Date(startedAt).getTime());
  const outcome=input.outcome === 'success' ? 'success' : 'failure';
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
  const receipt={
    ...identity,
    outcome,
    startedAt,
    completedAt:at,
    durationMs,
    ...(failure ? { failureStage:failure.stage, failureMessage:failure.message } : {}),
  };
  return {
    contractVersion:'1.0.0',
    status:outcome === 'success' ? 'healthy' : 'failed',
    ...identity,
    startedAt,
    completedAt:at,
    durationMs,
    expectedIntervalMinutes:current?.expectedIntervalMinutes || DEFAULT_EXPECTED_INTERVAL_MINUTES,
    delayAfterMinutes:current?.delayAfterMinutes || DEFAULT_DELAY_AFTER_MINUTES,
    staleAfterMinutes:current?.staleAfterMinutes || DEFAULT_STALE_AFTER_MINUTES,
    lastSuccessfulAt:outcome === 'success' ? at : (current?.lastSuccessfulAt || null),
    lastFailedAt:outcome === 'failure' ? at : (current?.lastFailedAt || null),
    consecutiveFailures:outcome === 'success' ? 0 : Number(current?.consecutiveFailures || 0) + 1,
    lastFailure:failure || current?.lastFailure || null,
    recentRuns:[...(current?.recentRuns || []),receipt].slice(-20),
  };
}

module.exports={
  DEFAULT_EXPECTED_INTERVAL_MINUTES,DEFAULT_DELAY_AFTER_MINUTES,DEFAULT_STALE_AFTER_MINUTES,
  beginWorkerRun,finishWorkerRun,runIdentity,
};
