#!/usr/bin/env node
'use strict';

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {runHazardWatch}=require('./hazard-watch');
const {writePublicSnapshot}=require('../workflows/hazard-snapshot');
const path=require('path');

function workflowRunUrl(env){return env.GITHUB_RUN_ID&&env.GITHUB_REPOSITORY?`${env.GITHUB_SERVER_URL||'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`:null;}
async function main(options={}){
  const env=options.env||process.env;const store=options.store||new FirestoreBackofficeStore();
  try{const result=await runHazardWatch({...options,store,runId:env.GITHUB_RUN_ID||null,workflowRunUrl:workflowRunUrl(env)});console.log(`[hazard-watch-live] ${result.status.summary.active} protected warnings; ${result.status.summary.awaitingRemovalReview} awaiting removal review; ${result.status.summary.sourceFailures} source failures.`);const snapshot=await writePublicSnapshot(options.root||path.resolve(__dirname,'..','..'),result.publicData);console.log(snapshot.changed?`[hazard-watch-live] Public snapshot refreshed (${snapshot.hazards} warnings); it reaches the website through the snapshot pull request.`:'[hazard-watch-live] Public snapshot unchanged; no website mutation.');return {...result,snapshot};}
  catch(error){await store.setArtifact('hazard-watch-status',{contractVersion:'1.0.0',status:'failed',checkedAt:options.at||new Date().toISOString(),runId:env.GITHUB_RUN_ID||null,workflowRunUrl:workflowRunUrl(env),failureMessage:String(error?.message||error).slice(0,2000),publicMutationAllowed:false},{status:'failed'});throw error;}
}
if(require.main===module)main().catch(error=>{console.error(`[hazard-watch-live] ${error.stack||error.message}`);process.exitCode=1;});
module.exports={workflowRunUrl,main};
