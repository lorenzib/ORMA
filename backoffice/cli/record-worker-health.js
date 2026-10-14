#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const {randomUUID}=require('crypto');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {beginWorkerRun,finishWorkerRun}=require('../workflows/worker-health');
const {summarizeFailureLog}=require('./record-publication-failure');

function workflowRunUrl(env){
  return env.GITHUB_SERVER_URL&&env.GITHUB_REPOSITORY&&env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : null;
}

function runInput(env){
  return {
    runId:env.GITHUB_RUN_ID,
    runAttempt:env.GITHUB_RUN_ATTEMPT,
    workflowRunUrl:env.ORMA_WORKER_RUN_URL || workflowRunUrl(env),
    eventName:env.GITHUB_EVENT_NAME,
    branch:env.GITHUB_REF_NAME,
    commitSha:env.GITHUB_SHA,
  };
}

async function failureMessage(env){
  if(env.ORMA_WORKER_FAILURE_MESSAGE)return summarizeFailureLog(env.ORMA_WORKER_FAILURE_MESSAGE);
  if(!env.ORMA_WORKER_FAILURE_LOG)return summarizeFailureLog('');
  try{return summarizeFailureLog(await fs.readFile(env.ORMA_WORKER_FAILURE_LOG,'utf8'));}
  catch(error){return summarizeFailureLog(`Could not read worker failure log: ${error.message}`);}
}

// The worker hands these across the step boundary as GitHub step outputs; the
// workflow forwards them here. Absent means the queue step never ran, which is
// different from a run that attempted nothing.
function workInput(env){
  if(!env.ORMA_WORKER_WORK_OUTCOME) return null;
  return {
    outcome:env.ORMA_WORKER_WORK_OUTCOME,
    attempted:Number.parseInt(env.ORMA_WORKER_WORK_ATTEMPTED,10) || 0,
    succeeded:Number.parseInt(env.ORMA_WORKER_WORK_SUCCEEDED,10) || 0,
    failed:Number.parseInt(env.ORMA_WORKER_WORK_FAILED,10) || 0,
    providerParked:env.ORMA_WORKER_WORK_PROVIDER_PARKED === 'true',
    message:env.ORMA_WORKER_WORK_MESSAGE || null,
    ...(/^\d+$/.test(String(env.ORMA_WORKER_WORK_READS || '')) ? { usage:{ reads:Number(env.ORMA_WORKER_WORK_READS), writes:Number(env.ORMA_WORKER_WORK_WRITES) || 0 } } : {}),
  };
}

// Out to the workflow, so something can act on a worker that has stopped.
// The count was recorded from the very first run and read only by the
// dashboard, which nobody opens while they believe the pipeline is running: it
// died at 16:00 on 13 October on an oversized Firestore document and was found
// hours later by being asked about, not by saying so.
//
// Single-line values only, so none of them can break out of the output file:
// a status and a count are enumerated, a timestamp is ISO, and the stage is
// already capped at 160 characters by the receipt that records it.
function healthOutputs(health={}){
  return {
    health_status:String(health.status||''),
    consecutive_failures:String(Number(health.consecutiveFailures||0)),
    last_successful_at:String(health.lastSuccessfulAt||''),
    // `lastFailure`, not `failure`: the receipt names it that way, and reading
    // the wrong key reported every stopped worker as stage "unknown".
    failure_stage:String(health.lastFailure?.stage||'').replace(/[\r\n]+/g,' ').trim(),
    // A run that completes every step and gets nothing done is the other way
    // the pipeline stops, and the quieter one: the run is green, the schedule
    // keeps firing, and the dashboard nobody opens is the only thing that
    // knows. It is how the pipeline sat dead from 11 October, and how it
    // stopped again on 14 October when the OpenAI credits ran out mid-session.
    consecutive_unproductive:String(Number(health.consecutiveUnproductiveRuns||0)),
    last_productive_at:String(health.lastProductiveAt||''),
    unproductive_since:String(health.lastUnproductive?.since||''),
    // Billing or an outage rather than anything in the code, which is a
    // different thing to go and do.
    provider_parked:String(Boolean(health.lastUnproductive?.providerParked)),
  };
}

async function announceHealth(health,env=process.env){
  if(!env.GITHUB_OUTPUT) return null;
  const outputs=healthOutputs(health);
  // The provider's own words, which is what says "no credits remaining"
  // rather than "something went wrong". Arbitrary text over several lines, so
  // it travels in a heredoc with a random delimiter per GitHub's guidance: a
  // fixed one appearing inside the message would let it break out of the file.
  const message=String(health.lastUnproductive?.message||'').trim();
  const delimiter=`ORMA_HEALTH_${randomUUID().replace(/-/g,'')}`;
  await fs.appendFile(env.GITHUB_OUTPUT,
    `${Object.entries(outputs).map(([key,value])=>`${key}=${value}`).join('\n')}\n`
    +`unproductive_message<<${delimiter}\n${message}\n${delimiter}\n`);
  return {...outputs,unproductive_message:message};
}

async function main(options={}){
  const env=options.env||process.env;
  const store=options.store||new FirestoreBackofficeStore();
  const previous=await store.getArtifact('worker-health');
  const phase=env.ORMA_WORKER_HEALTH_PHASE||'finish';
  const input=runInput(env);
  const at=options.at||new Date().toISOString();
  const health=phase==='start'
    ? beginWorkerRun(previous,input,{at})
    : finishWorkerRun(previous,{
      ...input,
      outcome:env.ORMA_WORKER_HEALTH_OUTCOME,
      failureStage:env.ORMA_WORKER_FAILURE_STAGE,
      failureMessage:await failureMessage(env),
      validationRunUrl:env.ORMA_WORKER_VALIDATION_RUN_URL,
      work:workInput(env),
    },{at});
  await store.setArtifact('worker-health',health,{runId:health.runId,status:health.status});
  console.log(`[orma-worker-health] ${health.status} · run ${health.runId||'manual'} · ${health.workflowRunUrl||'no run URL'}`);
  await announceHealth(health,env);
  return health;
}

if(require.main===module)main().catch(error=>{console.error(`[orma-worker-health] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={announceHealth,failureMessage,healthOutputs,main,runInput,workInput,workflowRunUrl};
