'use strict';

const VERSION = '1.0.0';

/**
 * An output's status, which is where it has got to -- not what it says.
 *
 * `ready-for-review` and `blocked` were the only two for a long time, and that
 * made a reviewed output indistinguishable from one nobody had opened: every
 * one of the six outputs behind the three published trails still read
 * `ready-for-review` on 7 October, months after their decisions were approved
 * and their trails went live. A count of "ready for review" that includes
 * finished work cannot be acted on, and the first genuine queue would have
 * looked exactly like that residue.
 *
 * So a decision moves the output. The reviewed values mirror the outcome
 * statuses recordVerifiedTrailReview already returns, so there is one
 * vocabulary rather than two that have to be kept in step.
 */
const REVIEWED_STATUSES = Object.freeze([
  'editorial-approved', 'asset-and-licensing-approved', 'revision-queued', 'rejected',
]);
const OUTPUT_STATUSES = Object.freeze(['ready-for-review', 'blocked', ...REVIEWED_STATUSES]);

function validateContentExecution(execution){
  const errors = [];
  if(!execution || typeof execution !== 'object') return ['execution must be an object'];
  if(execution.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(execution.mode !== 'draft-only') errors.push('mode must be draft-only');
  if(execution.publicMutationAllowed !== false) errors.push('publicMutationAllowed must be false');
  if(!Array.isArray(execution.outputs)) errors.push('outputs must be an array');
  (execution.outputs || []).forEach((output, index) => {
    if(!OUTPUT_STATUSES.includes(output.status)) errors.push(`outputs[${index}].status is invalid`);
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

module.exports = { VERSION, OUTPUT_STATUSES, REVIEWED_STATUSES, validateContentExecution };
