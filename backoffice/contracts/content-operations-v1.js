'use strict';

const VERSION = '1.0.0';
const WORKSTREAMS = ['guides', 'collections', 'newsletter', 'library-enrichment', 'social'];

function validateContentOperations(plan){
  const errors = [];
  if(!plan || typeof plan !== 'object') return ['plan must be an object'];
  if(plan.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(plan.mode !== 'draft-only') errors.push('mode must be draft-only');
  if(plan.publicMutationAllowed !== false) errors.push('publicMutationAllowed must be false');
  if(!Array.isArray(plan.workstreams)) errors.push('workstreams must be an array');
  if(!Array.isArray(plan.jobs)) errors.push('jobs must be an array');
  (plan.workstreams || []).forEach((stream, index) => {
    if(!WORKSTREAMS.includes(stream.id)) errors.push(`workstreams[${index}].id is invalid`);
    if(!stream.cadence) errors.push(`workstreams[${index}].cadence is required`);
    if(!['active', 'parked'].includes(stream.status)) errors.push(`workstreams[${index}].status is invalid`);
  });
  (plan.jobs || []).forEach((job, index) => {
    if(!['copywriter', 'visualDirector'].includes(job.agentId)) errors.push(`jobs[${index}].agentId is out of scope`);
    if(job.status !== 'queued') errors.push(`jobs[${index}].status must be queued`);
    if(!job.humanGate) errors.push(`jobs[${index}].humanGate is required`);
  });
  return errors;
}

module.exports = { VERSION, WORKSTREAMS, validateContentOperations };
