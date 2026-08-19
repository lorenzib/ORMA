'use strict';

const VERSION = '1.0.0';
const CATEGORIES = Object.freeze([
  'route', 'parking', 'elevation', 'water', 'heat', 'exposure',
  'livestock', 'surfaceHazards', 'access', 'photo',
]);
const STATUSES = Object.freeze(['unresolved', 'proposed', 'accepted', 'rejected', 'conflicted']);

function validateEvidence(record){
  const errors = [];
  if(!record || typeof record !== 'object') return ['evidence must be an object'];
  if(record.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(!CATEGORIES.includes(record.category)) errors.push('category is invalid');
  if(!STATUSES.includes(record.status)) errors.push('status is invalid');
  if(typeof record.claim !== 'string' || !record.claim.trim()) errors.push('claim is required');
  if(record.confidence !== null && (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1)){
    errors.push('confidence must be null or between 0 and 1');
  }
  if(!record.source || typeof record.source.url !== 'string') errors.push('source.url is required');
  if(!record.producedBy || typeof record.producedBy.component !== 'string') errors.push('producedBy.component is required');
  return errors;
}

module.exports = { VERSION, CATEGORIES, STATUSES, validateEvidence };
