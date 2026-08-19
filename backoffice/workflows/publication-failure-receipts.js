'use strict';

const RETRYABLE_PUBLICATION_STATUSES = new Set([
  'approved-for-pr-creation',
  'publication-failed',
]);

function publicationRequestIsRetryable(request){
  return RETRYABLE_PUBLICATION_STATUSES.has(request?.status) && request?.retryable !== false;
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
    if(!publicationRequestIsRetryable(request) || (candidateIds && !candidateIds.has(request.candidateId))) return request;
    const receipt = { stage, message, workflowRunUrl, pullRequestUrl, failedAt:at, retryable };
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
      failureCount:Number(request.failureCount || 0) + 1,
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
  publicationRequestIsRetryable,
  recordPublicationFailure,
};
