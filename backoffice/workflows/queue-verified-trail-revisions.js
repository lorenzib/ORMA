'use strict';

function buildVerifiedTrailRevisionJobs(execution, decisions, submittedAt, existingJobs = []){
  const outputs = new Map((execution?.outputs || []).map(output => [output.jobId, output]));
  return (decisions || []).filter(decision => decision.action === 'request-revision').map(decision => {
    const output = outputs.get(decision.jobId);
    if(!output) throw new Error(`Verified-trail revision output was not found: ${decision.jobId}`);
    if(!String(decision.note || '').trim()) throw new Error(`Revision instruction is required: ${decision.jobId}`);
    const previousAttempts = existingJobs.filter(job => job.jobId === decision.jobId).map(job => Number(job.attempt) || 0);
    const attempt = Math.max(0, ...previousAttempts) + 1;
    return {
      contractVersion: '1.0.0',
      id: `trail-revision-${decision.jobId}-${submittedAt.replace(/[:.]/g, '-')}`,
      jobId: decision.jobId,
      candidateId: output.candidateId,
      agentId: output.agentId,
      instruction: String(decision.note).trim().slice(0, 1500),
      status: 'queued', attempt, createdAt: submittedAt,
      humanGate: output.agentId === 'visualDirector' ? 'asset-and-licensing-approval' : 'editorial-approval',
      publicMutationAllowed: false,
    };
  });
}

module.exports = { buildVerifiedTrailRevisionJobs };
