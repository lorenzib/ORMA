'use strict';

function bounded(value,maximum=1000){return String(value||'').trim().slice(0,maximum);}

function publicTrailUrl(baseUrl,trailId){
  const base=(bounded(baseUrl)||'https://www.app-orma.com').replace(/\/+$/,'');
  const url=new URL('trail.html',`${base}/`);
  url.searchParams.set('id',trailId);
  return url.toString();
}

function clearActiveFailure(request){
  const {
    failureStage:_failureStage,failureMessage:_failureMessage,failedAt:_failedAt,
    failureKind:_failureKind,retryMode:_retryMode,retryAfter:_retryAfter,
    manualRetryAvailable:_manualRetryAvailable,...retained
  }=request;
  return retained;
}

function recordPublicationDeployment(requestArtifact,stagingArtifact,overrides,deployment,options={}){
  if(!requestArtifact||!Array.isArray(requestArtifact.requests))throw new Error('Publication request artifact is missing');
  if(!stagingArtifact||!Array.isArray(stagingArtifact.items))throw new Error('Publication staging artifact is missing');
  if(!overrides||!Array.isArray(overrides.trails))throw new Error('Verified trail overrides are missing');
  const at=options.at||new Date().toISOString();
  const commitSha=bounded(deployment?.commitSha,80);
  const deploymentRunUrl=bounded(deployment?.deploymentRunUrl);
  const publicBaseUrl=bounded(deployment?.publicBaseUrl)||'https://www.app-orma.com';
  if(!commitSha)throw new Error('Publication deployment commit SHA is required');
  if(!deploymentRunUrl)throw new Error('Successful deployment run URL is required');
  const overrideByApproval=new Map(overrides.trails.filter(entry=>entry?.approvalId).map(entry=>[entry.approvalId,entry]));
  const publishedCandidates=new Map();
  const requests=requestArtifact.requests.map(request=>{
    const override=overrideByApproval.get(request.id);
    if(request.status!=='pull-request-opened'||!override)return request;
    const candidateId=request.candidateId||override.candidateId;
    const targetTrailId=request.targetTrailId||override.id||override.fields?.id;
    if(!candidateId||!targetTrailId)return request;
    const publicUrl=publicTrailUrl(publicBaseUrl,targetTrailId);
    publishedCandidates.set(candidateId,{targetTrailId,publicUrl,approvalId:request.id});
    return {...clearActiveFailure(request),status:'published',retryable:false,publishedAt:at,deployedAt:at,
      publicationCommit:commitSha,deploymentRunUrl,publicUrl,publicMutationAllowed:false,publicMutationCompleted:true,
      deploymentReceipt:{status:'published',commitSha,deploymentRunUrl,publicUrl,deployedAt:at}};
  });
  const items=stagingArtifact.items.map(item=>{
    const receipt=publishedCandidates.get(item.candidateId);if(!receipt)return item;
    return {...item,state:'published',status:'published',publishedAt:at,deployedAt:at,publicationCommit:commitSha,
      deploymentRunUrl,publicUrl:receipt.publicUrl,publicationApprovalId:receipt.approvalId,
      publicMutationAllowed:false,publicMutationCompleted:true};
  });
  const published=publishedCandidates.size;
  return {
    requestsArtifact:{...requestArtifact,updatedAt:at,requests},
    stagingArtifact:{...stagingArtifact,updatedAt:at,items,summary:{...(stagingArtifact.summary||{}),trails:items.length,
      readyForPreview:items.filter(item=>item.state==='ready-for-publication-preview').length,
      waitingForApprovals:items.filter(item=>item.state==='waiting-content-approvals').length,
      published:items.filter(item=>item.state==='published').length,
      publicMutations:items.filter(item=>item.publicMutationCompleted===true).length}},
    published,candidateIds:[...publishedCandidates.keys()],
  };
}

module.exports={bounded,publicTrailUrl,clearActiveFailure,recordPublicationDeployment};
