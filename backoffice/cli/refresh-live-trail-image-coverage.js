#!/usr/bin/env node
'use strict';

const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {auditImageCoverage}=require('../workflows/audit-image-coverage');
const {queuePriorityImageSourcing,DEFAULT_IMAGE_SOURCING_CAPACITY}=require('../workflows/hosted-image-coverage');

function workflowRunUrl(env){return env.GITHUB_RUN_ID&&env.GITHUB_REPOSITORY?`${env.GITHUB_SERVER_URL||'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`:null;}

function sourcingCapacity(env, fallback=DEFAULT_IMAGE_SOURCING_CAPACITY){
  const requested=Number.parseInt(env.ORMA_IMAGE_SOURCING_CAPACITY||'',10);
  if(!Number.isFinite(requested))return fallback;
  return Math.max(1,Math.min(DEFAULT_IMAGE_SOURCING_CAPACITY,requested));
}

async function main(options={}){
  const root=options.root||path.resolve(__dirname,'../..');const env=options.env||process.env;const store=options.store||new FirestoreBackofficeStore();
  const startedAt=options.at||new Date().toISOString();const statusBase={contractVersion:'1.0.0',runId:env.GITHUB_RUN_ID||null,
    workflowRunUrl:workflowRunUrl(env),trigger:env.GITHUB_EVENT_NAME||'manual',startedAt,publicMutationAllowed:false};
  await store.setArtifact('trail-image-coverage-status',{...statusBase,status:'running'},{status:'running'});
  try{
    const audit=await auditImageCoverage(root,{at:startedAt});
    const capacity=options.capacity??sourcingCapacity(env);
    const sourcing=await queuePriorityImageSourcing(store,audit,{at:startedAt,capacity});
    const completedAt=options.completedAt||new Date().toISOString();
    await Promise.all([
      store.setArtifact('image-coverage',audit,{mode:audit.mode,publicMutationAllowed:false}),
      store.setArtifact('trail-image-coverage-status',{...statusBase,status:'healthy',completedAt,lastSuccessfulAt:completedAt,summary:{...audit.summary,sourcing}},{status:'healthy'}),
    ]);
    console.log(`[trail-image-coverage] ${audit.summary.trailsScanned} published trails scanned; ${audit.summary.missing} need photos; ${audit.summary.dolomitesMissing} Dolomites gaps.`);
    console.log(`[trail-image-coverage] ${sourcing.queued} credited-photo search job(s) queued; ${sourcing.active}/${sourcing.capacity} active slots.`);
    console.log('[trail-image-coverage] Protected review queue refreshed. Nothing was published.');return {...audit,sourcing};
  }catch(error){
    const failedAt=options.completedAt||new Date().toISOString();
    await store.setArtifact('trail-image-coverage-status',{...statusBase,status:'failed',completedAt:failedAt,lastFailure:{failedAt,message:String(error.message||error).slice(0,2000)},publicMutationAllowed:false},{status:'failed'});
    throw error;
  }
}

if(require.main===module)main().catch(error=>{console.error(`[trail-image-coverage] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={workflowRunUrl,sourcingCapacity,main};
