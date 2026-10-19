#!/usr/bin/env node
'use strict';

const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {loadProductionTrails}=require('../../scripts/load-production-trails');
const {runScheduledTrailCampaign}=require('../workflows/campaign-scheduler');
const {currentSiteTrails}=require('../services/public-site-trails');

// A pass is a batch; the fleet is the programme. Two different numbers.
const MAX_LIMIT=25;
const MAX_CAPACITY=200;

async function main(args=process.argv.slice(2)){
  const flag=args.indexOf('--limit');const limit=flag>=0?Number(args[flag+1]):10;
  const capacityFlag=args.indexOf('--capacity');const capacity=capacityFlag>=0?Number(args[capacityFlag+1]):15;
  // How many trails one pass may admit. Small on purpose: a pass is a batch,
  // not the programme.
  if(!Number.isInteger(limit)||limit<1||limit>MAX_LIMIT)throw new Error(`--limit must be an integer between 1 and ${MAX_LIMIT}`);
  // How many trails may be in flight at once, which is a different question
  // and a much larger number. It shared the batch ceiling, so a capacity of 60
  // -- the figure the repository variable has held since 18 October -- could
  // not have been accepted even once the workflow passed it: the command would
  // have thrown. The guard is still here, set above anything the catalogue can
  // hold, so a slipped digit is still refused.
  if(!Number.isInteger(capacity)||capacity<1||capacity>MAX_CAPACITY)throw new Error(`--capacity must be an integer between 1 and ${MAX_CAPACITY}`);
  const root=path.resolve(__dirname,'../..');const store=new FirestoreBackofficeStore();
  const force=!args.includes('--scheduled')||args.includes('--force');
  const workflowRunUrl=process.env.GITHUB_RUN_ID&&process.env.GITHUB_REPOSITORY
    ?`${process.env.GITHUB_SERVER_URL||'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null;
  const result=await runScheduledTrailCampaign(store,currentSiteTrails(loadProductionTrails(root)),{enabled:true,force,limit,capacity,
    trigger:force?'manual':'daily-backup',workflowRunUrl,runId:process.env.GITHUB_RUN_ID||null});
  if(result.status!=='completed'){
    console.log(`[trail-campaign] ${result.status}. Next eligible: ${result.nextEligibleAt||'not recorded'}`);return result;
  }
  console.log(`[trail-campaign] Queued ${result.jobIds.length} new Cartographer job(s).`);
  result.jobIds.forEach(id=>console.log(`[trail-campaign] ${id}`));
  console.log(`[trail-campaign] Remaining queueable: ${result.campaign.summary.remainingQueueable}`);
  return result;
}

if(require.main===module)main().catch(error=>{console.error(`[trail-campaign] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={MAX_LIMIT,MAX_CAPACITY,main};
