#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
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
    },{at});
  await store.setArtifact('worker-health',health,{runId:health.runId,status:health.status});
  console.log(`[orma-worker-health] ${health.status} · run ${health.runId||'manual'} · ${health.workflowRunUrl||'no run URL'}`);
  return health;
}

if(require.main===module)main().catch(error=>{console.error(`[orma-worker-health] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={failureMessage,main,runInput,workflowRunUrl};
