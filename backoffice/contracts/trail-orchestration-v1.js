'use strict';

const VERSION = '1.0.0';
const STATES = Object.freeze([
  'geometry-audit', 'geometry-human-gate', 'evidence-research', 'evidence-resolution',
  'provenance-audit', 'red-team', 'dossier-human-gate',
  'ready-for-editorial', 'rejected', 'blocked',
]);

function validateTrailOrchestration(artifact){
  const errors=[];
  if(!artifact || typeof artifact!=='object') return ['orchestration must be an object'];
  if(artifact.contractVersion!==VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(!Array.isArray(artifact.trails)) errors.push('trails must be an array');
  const ids=new Set();
  for(const [index,trail] of (artifact.trails||[]).entries()){
    if(typeof trail.trailId!=='string'||!trail.trailId) errors.push(`trails[${index}].trailId is required`);
    if(ids.has(trail.trailId)) errors.push(`trails[${index}].trailId is duplicated`); ids.add(trail.trailId);
    if(!STATES.includes(trail.state)) errors.push(`trails[${index}].state is invalid`);
    if(!trail.attempts||typeof trail.attempts!=='object') errors.push(`trails[${index}].attempts is required`);
    if(!trail.resolutionAttempts||typeof trail.resolutionAttempts!=='object') errors.push(`trails[${index}].resolutionAttempts is required`);
    if(!Array.isArray(trail.jobIds)) errors.push(`trails[${index}].jobIds must be an array`);
    if(trail.publicMutationAllowed!==false) errors.push(`trails[${index}] must prohibit public mutation`);
  }
  if(artifact.publicMutationAllowed!==false) errors.push('orchestration must prohibit public mutation');
  return errors;
}

module.exports={VERSION,STATES,validateTrailOrchestration};
