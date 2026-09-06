#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');

const FILES = Object.freeze({
  'verified-trail-editorial-queue':'verified-trail-editorial-queue.json',
  'verified-trail-editorial-execution':'verified-trail-editorial-execution.json',
  'content-review-queue':'content-review-queue.json',
  'publication-staging':'publication-staging.json',
  'trail-orchestration':'trail-orchestration.json',
  'dossier-review-queue':'dossier-review-queue.json',
  // The route-choice queue the Backoffice Home surfaces and the Trail
  // Verification Desk reviews. Without this seed the artifact never reaches
  // Firestore, so the "Choose the intended route" cards never appear live.
  'route-review':'route-review.json',
});
const ROUTES = Object.freeze({
  'osm-relation-1484751':'tre-cime-classic.geojson',
  'osm-relation-6678431':'cinque-torri-three-refuges-assisted.geojson',
  'osm-way-25736154':'lago-braies-circuit.geojson',
});

function trailOnlyReviewQueue(queue){
  const submissions=(queue.submissions||[]).map(submission=>({
    ...submission,
    decisions:(submission.decisions||[]).filter(decision=>String(decision.jobId||'').startsWith('verified-')),
  })).filter(submission=>submission.decisions.length>0);
  return {...queue,submissions};
}

async function main(){
  const root = path.resolve(__dirname, '../..'); const store = new FirestoreBackofficeStore();
  for(const [id, name] of Object.entries(FILES)){
    let data = JSON.parse(await fs.readFile(path.join(root, 'backoffice-data', name), 'utf8'));
    if(id==='content-review-queue') data=trailOnlyReviewQueue(data);
    if(id==='trail-orchestration'){
      data={...data,trails:(data.trails||[]).map(trail=>({...trail,
        latestOutputRef:trail.currentJobId?`firestore:trail-specialist-output-${trail.currentJobId}`:trail.latestOutputRef}))};
    }
    const created=await store.setArtifactIfAbsent(id,data,{seededFrom:name});console.log(`[orma-seed] ${id} · ${created?'created':'already present'}`);
  }
  const revisionQueue = JSON.parse(await fs.readFile(path.join(root, 'backoffice-data', 'verified-trail-revision-queue.json'), 'utf8'));
  for(const job of revisionQueue.jobs || []) await store.putJobIfAbsent(job);
  console.log(`[orma-seed] ${revisionQueue.jobs?.length || 0} revision jobs`);
  const campaignExecution=JSON.parse(await fs.readFile(path.join(root,'backoffice-data','campaign-execution.json'),'utf8'));
  for(const job of campaignExecution.jobs||[]){
    await store.putJobIfAbsent({...job,status:'completed',jobType:'trail-verification-specialist',attempt:1,
      outputRef:`firestore:trail-specialist-output-${job.id}`,publicMutationAllowed:false});
  }
  console.log(`[orma-seed] ${campaignExecution.jobs?.length||0} initial Cartographer jobs`);
  let specialistQueue={jobs:[]};
  try{specialistQueue=JSON.parse(await fs.readFile(path.join(root,'backoffice-data','trail-specialist-job-queue.json'),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;}
  for(const job of specialistQueue.jobs||[]){
    const initial=(campaignExecution.jobs||[]).find(item=>item.candidateId===job.candidateId);
    const inputRefs=(job.inputRefs||[]).map(ref=>String(ref).startsWith('backoffice-data/cartographer/')&&initial
      ?`firestore:trail-specialist-output-${initial.id}`:ref);
    await store.putJobIfAbsent({...job,inputRefs});
  }
  console.log(`[orma-seed] ${specialistQueue.jobs?.length||0} pending trail specialist jobs`);
  for(const [candidateId,name] of Object.entries(ROUTES)){
    const route = JSON.parse(await fs.readFile(path.join(root,'backoffice-data','route-proposals',name),'utf8'));
    await store.setArtifactIfAbsent(`route-proposal-${candidateId}`,route,{seededFrom:name});
    console.log(`[orma-seed] route-proposal-${candidateId}`);
  }
  const orchestration=JSON.parse(await fs.readFile(path.join(root,'backoffice-data','trail-orchestration.json'),'utf8'));
  for(const trail of orchestration.trails||[]){
    if(!trail.latestOutputRef)continue;
    const output=JSON.parse(await fs.readFile(path.join(root,trail.latestOutputRef),'utf8'));
    await store.setArtifactIfAbsent(`trail-specialist-output-${trail.currentJobId}`,output,{seededFrom:trail.latestOutputRef});
    console.log(`[orma-seed] trail-specialist-output-${trail.currentJobId}`);
  }
}

if(require.main === module) main().catch(error => { console.error(`[orma-seed] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { FILES, ROUTES, trailOnlyReviewQueue, main };
