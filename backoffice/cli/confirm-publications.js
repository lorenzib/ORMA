#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');
const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {recordPublicationDeployment}=require('../workflows/publication-deployment-receipts');

async function main(options={}){
  const root=options.root||path.resolve(__dirname,'../..');const env=options.env||process.env;
  const overridesPath=env.ORMA_PUBLICATION_OVERRIDES_PATH?path.resolve(root,env.ORMA_PUBLICATION_OVERRIDES_PATH):path.join(root,'data/verified-trail-overrides.json');
  const overrides=JSON.parse(await fs.readFile(overridesPath,'utf8'));
  const store=options.store||new FirestoreBackofficeStore();
  const [requests,staging]=await Promise.all([store.getArtifact('publication-requests'),store.getArtifact('publication-staging')]);
  if(!requests||!staging){console.log('[orma-publication] No protected publication receipt is ready for deployment reconciliation.');return {published:0,candidateIds:[]};}
  const result=recordPublicationDeployment(requests,staging,overrides,{
    commitSha:env.ORMA_PUBLICATION_COMMIT_SHA,
    deploymentRunUrl:env.ORMA_PUBLICATION_DEPLOYMENT_URL,
    publicBaseUrl:env.ORMA_PUBLICATION_PUBLIC_BASE_URL||'https://www.app-orma.com',
  },{at:options.at});
  if(result.published)await Promise.all([
    store.setArtifact('publication-requests',result.requestsArtifact,{lastDeploymentCommit:env.ORMA_PUBLICATION_COMMIT_SHA}),
    store.setArtifact('publication-staging',result.stagingArtifact,{lastDeploymentCommit:env.ORMA_PUBLICATION_COMMIT_SHA}),
  ]);
  console.log(`[orma-publication] Confirmed ${result.published} deployed publication request(s).`);
  return result;
}

if(require.main===module)main().catch(error=>{console.error(`[orma-publication] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
