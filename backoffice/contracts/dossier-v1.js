'use strict';

const VERSION = '1.0.0';
const CLAIM_STATES = ['supported', 'conflicted', 'unresolved'];
const REVIEW_STATES = ['blocked', 'ready-for-human-review', 'accepted', 'rejected'];

function validateDossier(dossier){
  const errors = [];
  if(!dossier || typeof dossier !== 'object') return ['dossier must be an object'];
  if(dossier.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(typeof dossier.candidateId !== 'string' || !dossier.candidateId) errors.push('candidateId is required');
  if(!REVIEW_STATES.includes(dossier.reviewState)) errors.push('reviewState is invalid');
  if(!Array.isArray(dossier.sources) || !dossier.sources.length) errors.push('sources are required');
  if(!Array.isArray(dossier.claims) || !dossier.claims.length) errors.push('claims are required');
  const sourceIds = new Set((dossier.sources || []).map(source => source.id));
  (dossier.claims || []).forEach((claim, index) => {
    if(typeof claim.id !== 'string' || !claim.id) errors.push(`claims[${index}].id is required`);
    if(!CLAIM_STATES.includes(claim.state)) errors.push(`claims[${index}].state is invalid`);
    if(typeof claim.proposedValue !== 'string' || !claim.proposedValue) errors.push(`claims[${index}].proposedValue is required`);
    if(!Array.isArray(claim.sourceIds)) errors.push(`claims[${index}].sourceIds must be an array`);
    else claim.sourceIds.forEach(id => { if(!sourceIds.has(id)) errors.push(`claims[${index}] references unknown source ${id}`); });
    if(claim.state !== 'supported' && (!claim.blocker || typeof claim.blocker !== 'string')){
      errors.push(`claims[${index}] requires a blocker`);
    }
  });
  if(dossier.reviewState === 'accepted' && dossier.claims.some(claim => claim.state !== 'supported')){
    errors.push('accepted dossiers require every claim to be supported');
  }
  return errors;
}

module.exports = { VERSION, CLAIM_STATES, REVIEW_STATES, validateDossier };
