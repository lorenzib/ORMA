#!/usr/bin/env node
'use strict';

const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {loadProductionTrails}=require('../../scripts/load-production-trails');
const {startLiveTrailCampaign}=require('../workflows/start-live-trail-campaign');

async function main(args=process.argv.slice(2)){
  const flag=args.indexOf('--limit');const limit=flag>=0?Number(args[flag+1]):5;
  if(!Number.isInteger(limit)||limit<1||limit>25)throw new Error('--limit must be an integer between 1 and 25');
  const root=path.resolve(__dirname,'../..');const store=new FirestoreBackofficeStore();
  const result=await startLiveTrailCampaign(store,loadProductionTrails(root),{limit});
  console.log(`[trail-campaign] Queued ${result.jobIds.length} new Cartographer job(s).`);
  result.jobIds.forEach(id=>console.log(`[trail-campaign] ${id}`));
  console.log(`[trail-campaign] Remaining queueable: ${result.campaign.summary.remainingQueueable}`);
}

if(require.main===module)main().catch(error=>{console.error(`[trail-campaign] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
