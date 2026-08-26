'use strict';

const {publicTrailUrl}=require('./publication-deployment-receipts');

function publicAssetUrl(baseUrl,assetRef){
  const base=String(baseUrl||'https://www.app-orma.com').replace(/\/+$/,'');
  return new URL(String(assetRef||'').replace(/^\/+/,''),`${base}/`).toString();
}

function recordTrailImageDeployment(requestArtifact,overrides,deployment,options={}){
  if(!requestArtifact||!Array.isArray(requestArtifact.requests))throw new Error('Trail-image publication requests are missing');
  if(!overrides||!Array.isArray(overrides.trails))throw new Error('Trail-image overrides are missing');
  const commitSha=String(deployment?.commitSha||'').trim();const deploymentRunUrl=String(deployment?.deploymentRunUrl||'').trim();
  if(!commitSha)throw new Error('Trail-image deployment commit SHA is required');
  if(!deploymentRunUrl)throw new Error('Successful trail-image deployment run URL is required');
  const at=options.at||new Date().toISOString();const publicBaseUrl=deployment?.publicBaseUrl||'https://www.app-orma.com';
  const byApproval=new Map(overrides.trails.filter(entry=>entry?.approvedReviewId).map(entry=>[entry.approvedReviewId,entry]));let published=0;
  const requests=requestArtifact.requests.map(request=>{
    const override=byApproval.get(request.id);
    if(request.status!=='awaiting-pr-merge'||!override?.fields?.imageIcon)return request;
    published+=1;return {...request,status:'published',publishedAt:at,deployedAt:at,publicationCommit:commitSha,deploymentRunUrl,
      publicUrl:publicTrailUrl(publicBaseUrl,request.trailId||override.id),publicAssetUrl:publicAssetUrl(publicBaseUrl,override.fields.imageIcon),
      publicMutationAllowed:false,publicMutationCompleted:true};
  });
  return {artifact:{...requestArtifact,updatedAt:at,requests},published,requestIds:requests.filter(item=>item.status==='published'&&item.publishedAt===at).map(item=>item.id)};
}

module.exports={publicAssetUrl,recordTrailImageDeployment};
