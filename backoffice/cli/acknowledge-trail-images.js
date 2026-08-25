#!/usr/bin/env node
'use strict';

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');

async function main(){
  const prUrl=String(process.env.ORMA_PUBLICATION_PR_URL||'').trim();if(!prUrl)throw new Error('ORMA_PUBLICATION_PR_URL is required');
  const store=new FirestoreBackofficeStore();const artifact=await store.getArtifact('trail-image-publication-requests');
  if(!artifact)return;
  const at=new Date().toISOString();let changed=0;
  const requests=(artifact.requests||[]).map(request=>{
    if(request.status!=='pr-materialized')return request;changed+=1;
    return {...request,status:'awaiting-pr-merge',publicationPrUrl:prUrl,prCreatedAt:at,publicMutationAllowed:false};
  });
  if(changed)await store.setArtifact('trail-image-publication-requests',{...artifact,updatedAt:at,requests},{publicationPrUrl:prUrl,publicMutationAllowed:false});
  console.log(`[trail-images] ${changed} approved photo(s) attached to ${prUrl}.`);
}

if(require.main===module)main().catch(error=>{console.error(`[trail-images] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
