'use strict';

const VERSION = '1.0.0';
const TASK_KINDS = ['edit-copy', 'gather-pictures'];

function validateContentFlow(flow){
  const errors = [];
  if(!flow || typeof flow !== 'object') return ['flow must be an object'];
  if(flow.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(flow.mode !== 'draft-only') errors.push('mode must be draft-only');
  if(flow.publicMutationAllowed !== false) errors.push('publicMutationAllowed must be false');
  if(!Array.isArray(flow.items)) errors.push('items must be an array');
  if(!Array.isArray(flow.jobs)) errors.push('jobs must be an array');
  (flow.jobs || []).forEach((job, index) => {
    if(!TASK_KINDS.includes(job.action)) errors.push(`jobs[${index}].action is invalid`);
    if(!['copywriter', 'visualDirector'].includes(job.agentId)) errors.push(`jobs[${index}].agentId is out of scope`);
    if(job.status !== 'queued') errors.push(`jobs[${index}].status must be queued`);
    if(!job.humanGate) errors.push(`jobs[${index}].humanGate is required`);
  });
  return errors;
}

module.exports = { VERSION, TASK_KINDS, validateContentFlow };
