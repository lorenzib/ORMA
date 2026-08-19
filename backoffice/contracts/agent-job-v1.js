'use strict';

const { getAgent } = require('../agents/registry-v1');

const VERSION = '1.0.0';
const STATUSES = ['queued', 'running', 'completed', 'needs-human', 'failed', 'cancelled'];

function validateAgentJob(job){
  const errors = [];
  if(!job || typeof job !== 'object') return ['job must be an object'];
  if(job.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(!getAgent(job.agentId)) errors.push('agentId is not registered');
  if(typeof job.action !== 'string' || !job.action) errors.push('action is required');
  if(!STATUSES.includes(job.status)) errors.push('status is invalid');
  if(!Array.isArray(job.inputRefs)) errors.push('inputRefs must be an array');
  if(!Array.isArray(job.outputRefs)) errors.push('outputRefs must be an array');
  if(job.candidateId !== null && typeof job.candidateId !== 'string') errors.push('candidateId must be a string or null');
  if(job.status === 'completed' && !job.completedAt) errors.push('completed jobs require completedAt');
  return errors;
}

function createAgentJob(input, context = {}){
  const at = context.at || new Date().toISOString();
  const job = {
    contractVersion: VERSION,
    id: input.id,
    agentId: input.agentId,
    action: input.action,
    candidateId: input.candidateId || null,
    claimIds: input.claimIds || [],
    status: 'queued',
    inputRefs: input.inputRefs || [],
    outputRefs: [],
    requestedBy: input.requestedBy || 'workflow-orchestrator',
    createdAt: at,
    startedAt: null,
    completedAt: null,
    humanGate: input.humanGate || null,
  };
  const errors = validateAgentJob(job);
  if(errors.length) throw new Error(errors.join('; '));
  return job;
}

module.exports = { VERSION, STATUSES, validateAgentJob, createAgentJob };
