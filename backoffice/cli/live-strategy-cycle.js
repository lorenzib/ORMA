#!/usr/bin/env node
'use strict';

const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {runLiveStrategyCycle}=require('../workflows/run-live-strategy-cycle');

async function main(){
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is required');
  const runId=process.env.GITHUB_RUN_ID||null;
  const workflowRunUrl=runId&&process.env.GITHUB_REPOSITORY
    ?`${process.env.GITHUB_SERVER_URL||'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`:null;
  const result=await runLiveStrategyCycle(new FirestoreBackofficeStore(),{root:path.resolve(__dirname,'../..'),runId,workflowRunUrl,newsletterEnabled:process.env.ORMA_NEWSLETTER_ENABLED==='true'});
  console.log(`[strategy-cycle-live] ${result.summary.editorialActive} protected editorial packets; ${result.summary.imageGaps} image gaps.`);
  console.log(`[strategy-cycle-live] Analyst: ${result.summary.productIdeas} ideas (${result.summary.productStatus}). Newsletter: ${result.summary.newsletterStatus}.`);
  console.log('[strategy-cycle-live] Nothing was changed on the public website.');
}

if(require.main===module)main().catch(error=>{console.error(`[strategy-cycle-live] ${error.stack||error.message}`);process.exitCode=1;});
module.exports={main};
