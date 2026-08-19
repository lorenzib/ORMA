'use strict';

const VERSION = '1.0.0';
const REVIEW_STATES = ['blocked', 'ready-for-human-review', 'accepted', 'rejected'];

function validateCartographerResult(result){
  const errors = [];
  if(!result || typeof result !== 'object') return ['result must be an object'];
  if(result.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(typeof result.candidateId !== 'string' || !result.candidateId) errors.push('candidateId is required');
  if(!REVIEW_STATES.includes(result.reviewState)) errors.push('reviewState is invalid');
  if(!result.source || typeof result.source.url !== 'string') errors.push('source.url is required');
  if(!result.geometry || result.geometry.type !== 'LineString' || !Array.isArray(result.geometry.coordinates)){
    errors.push('full LineString geometry is required');
  }
  if(!result.assessment || !Array.isArray(result.assessment.issues)) errors.push('assessment is required');
  if(!result.comparison || typeof result.comparison !== 'object') errors.push('comparison is required');
  if(!result.humanGate || result.humanGate.required !== true) errors.push('human geometry gate is required');
  if(result.reviewState === 'accepted') errors.push('agents cannot return accepted geometry');
  return errors;
}

module.exports = { VERSION, REVIEW_STATES, validateCartographerResult };
