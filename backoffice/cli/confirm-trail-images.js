#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {recordTrailImageDeployment}=require('../workflows/trail-image-deployment-receipts');

async function main(options={}){
  const root=options.root||path.resolve(__dirname,'../..');const env=options.env||process.env;const store=options.store||new FirestoreBackofficeStore();
  const overridePath=env.ORMA_TRAIL_IMAGE_OVERRIDES_PATH?path.resolve(root,env.ORMA_TRAIL_IMAGE_OVERRIDES_PATH):path.join(root,'data/trail-image-overrides.json');
  const overrides=JSON.parse(await fs.readFile(overridePath,'utf8'));const requests=await store.getArtifact('trail-image-publication-requests');
  if(!requests){console.log('[trail-images] No protected trail-photo receipt is ready for deployment reconciliation.');return {published:0,requestIds:[]};}
  const result=recordTrailImageDeployment(requests,overrides,{commitSha:env.ORMA_PUBLICATION_COMMIT_SHA,deploymentRunUrl:env.ORMA_PUBLICATION_DEPLOYMENT_URL,
    publicBaseUrl:env.ORMA_PUBLICATION_PUBLIC_BASE_URL||'https://www.app-orma.com'},{at:options.at});
  if(result.published)await store.setArtifact('trail-image-publication-requests',result.artifact,{lastDeploymentCommit:env.ORMA_PUBLICATION_COMMIT_SHA});
  console.log(`[trail-images] Confirmed ${result.published} deployed trail photo(s).`);return result;
}

if(require.main===module)main().catch(error=>{console.error(`[trail-images] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
