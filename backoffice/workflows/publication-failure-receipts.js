'use strict';

const RETRYABLE_PUBLICATION_STATUSES = new Set([
  'approved-for-pr-creation',
  'publication-failed',
]);
const PUBLICATION_RETRY_DELAYS_MS=Object.freeze([15*60*1000,60*60*1000,6*60*60*1000,24*60*60*1000,72*60*60*1000]);

function publicationRequestIsRetryable(request,options={}){
  if(!RETRYABLE_PUBLICATION_STATUSES.has(request?.status)||request?.retryable===false)return false;
  if(request.retryMode==='manual')return options.force===true;
  if(options.force||!options.at||!request.retryAfter)return true;
  return new Date(request.retryAfter).getTime()<=new Date(options.at).getTime();
}

function publicationRequestCanRetry(request){
  return RETRYABLE_PUBLICATION_STATUSES.has(request?.status)&&request?.retryable!==false;
}

function bounded(value, maximum = 3000){
  return String(value || '').trim().slice(0, maximum);
}

function recordPublicationFailure(artifact, failure, options = {}){
  if(!artifact || !Array.isArray(artifact.requests)) throw new Error('Publication request artifact is missing');
  const at = options.at || new Date().toISOString();
  const stage = bounded(failure?.stage || 'publication-automation', 120);
  const message = bounded(failure?.message || 'Publication automation failed without a captured error message.');
  const workflowRunUrl = bounded(failure?.workflowRunUrl, 1000) || null;
  const pullRequestUrl = bounded(failure?.pullRequestUrl, 1000) || null;
  const retryable = failure?.retryable !== false;
  const candidateIds = failure?.candidateIds?.length ? new Set(failure.candidateIds) : null;
  let recorded = 0;
  const requests = artifact.requests.map(request => {
    if(!publicationRequestCanRetry(request) || (candidateIds && !candidateIds.has(request.candidateId))) return request;
    const failureCount=Number(request.failureCount||0)+1;
    const externalConfigurationRequired=stage==='pull-request-creation'&&/not permitted to create or approve pull requests/i.test(message);
    const failureKind=externalConfigurationRequired?'external-configuration-required':'automation-failure';
    const retryDelayMs=PUBLICATION_RETRY_DELAYS_MS[Math.min(failureCount-1,PUBLICATION_RETRY_DELAYS_MS.length-1)];
    const retryMode=externalConfigurationRequired?'manual':'automatic';
    const retryAfter=retryable&&!externalConfigurationRequired?new Date(new Date(at).getTime()+retryDelayMs).toISOString():null;
    const receipt = { stage, message, workflowRunUrl, pullRequestUrl, failedAt:at, retryable,failureKind,retryMode,retryAfter };
    recorded += 1;
    return {
      ...request,
      status:'publication-failed',
      retryable,
      failureStage:stage,
      failureMessage:message,
      workflowRunUrl,
      pullRequestUrl:pullRequestUrl || request.pullRequestUrl || null,
      failedAt:at,
      failureKind,retryMode,retryAfter,manualRetryAvailable:retryable,
      failureCount,
      failureHistory:[...(request.failureHistory || []), receipt].slice(-10),
    };
  });
  return {
    artifact:{ ...artifact, updatedAt:at, requests },
    recorded,
  };
}

module.exports = {
  RETRYABLE_PUBLICATION_STATUSES,
  PUBLICATION_RETRY_DELAYS_MS,
  publicationRequestCanRetry,publicationRequestIsRetryable,
  recordPublicationFailure,
};
