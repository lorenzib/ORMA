'use strict';

const VERSION = '1.0.0';

function validateContentExecution(execution){
  const errors = [];
  if(!execution || typeof execution !== 'object') return ['execution must be an object'];
  if(execution.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(execution.mode !== 'draft-only') errors.push('mode must be draft-only');
  if(execution.publicMutationAllowed !== false) errors.push('publicMutationAllowed must be false');
  if(!Array.isArray(execution.outputs)) errors.push('outputs must be an array');
  (execution.outputs || []).forEach((output, index) => {
    if(!['ready-for-review', 'blocked'].includes(output.status)) errors.push(`outputs[${index}].status is invalid`);
    if(!output.jobId) errors.push(`outputs[${index}].jobId is required`);
    if(!output.agentId) errors.push(`outputs[${index}].agentId is required`);
    if(output.agentId === 'visualDirector' && output.result){
      (output.result.candidates || []).forEach((candidate, candidateIndex) => {
        if(candidate.status === 'ready' && !candidate.assetUrl){
          errors.push(`outputs[${index}].result.candidates[${candidateIndex}] ready pictures require assetUrl preview`);
        }
      });
    }
  });
  return errors;
}

module.exports = { VERSION, validateContentExecution };
