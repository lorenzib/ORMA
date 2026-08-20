#!/usr/bin/env node
'use strict';

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {runHazardWatch}=require('./hazard-watch');

function workflowRunUrl(env){return env.GITHUB_RUN_ID&&env.GITHUB_REPOSITORY?`${env.GITHUB_SERVER_URL||'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`:null;}
async function main(options={}){
  const env=options.env||process.env;const store=options.store||new FirestoreBackofficeStore();
  try{const result=await runHazardWatch({...options,store,runId:env.GITHUB_RUN_ID||null,workflowRunUrl:workflowRunUrl(env)});console.log(`[hazard-watch-live] ${result.status.summary.active} protected warnings; ${result.status.summary.awaitingRemovalReview} awaiting removal review; ${result.status.summary.sourceFailures} source failures.`);console.log('[hazard-watch-live] No public website mutation was made.');return result;}
  catch(error){await store.setArtifact('hazard-watch-status',{contractVersion:'1.0.0',status:'failed',checkedAt:options.at||new Date().toISOString(),runId:env.GITHUB_RUN_ID||null,workflowRunUrl:workflowRunUrl(env),failureMessage:String(error?.message||error).slice(0,2000),publicMutationAllowed:false},{status:'failed'});throw error;}
}
if(require.main===module)main().catch(error=>{console.error(`[hazard-watch-live] ${error.stack||error.message}`);process.exitCode=1;});
module.exports={workflowRunUrl,main};
