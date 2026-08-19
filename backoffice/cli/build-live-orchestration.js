#!/usr/bin/env node
'use strict';

const fs=require('fs/promises'); const path=require('path');
const {seedOrchestrationFromCatalogue,buildDossierReviewQueue}=require('../workflows/build-live-orchestration');

async function main(){
  const root=path.resolve(__dirname,'../..'); const data=path.join(root,'backoffice-data');
  const [campaign,execution]=await Promise.all([
    fs.readFile(path.join(data,'catalogue-campaign.json'),'utf8').then(JSON.parse),
    fs.readFile(path.join(data,'campaign-execution.json'),'utf8').then(JSON.parse),
  ]);
  const outputs={};
  for(const ref of execution.outputs||[]){const result=JSON.parse(await fs.readFile(path.join(root,ref),'utf8'));outputs[result.candidateId]=result;}
  const at=new Date().toISOString(); const orchestration=seedOrchestrationFromCatalogue(campaign,execution,outputs,{at});
  const review=buildDossierReviewQueue(orchestration,outputs,{at});
  await Promise.all([
    fs.writeFile(path.join(data,'trail-orchestration.json'),`${JSON.stringify(orchestration,null,2)}\n`),
    fs.writeFile(path.join(data,'dossier-review-queue.json'),`${JSON.stringify(review,null,2)}\n`),
  ]);
  console.log(`[orma-orchestrator] ${review.summary.awaitingHuman} geometry dossiers ready; ${review.summary.blocked} blocked from approval.`);
}

if(require.main===module)main().catch(error=>{console.error(`[orma-orchestrator] ${error.stack||error.message}`);process.exitCode=1;});
module.exports={main};
