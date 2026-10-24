'use strict';

const VERSION = '1.0.0';
const STATES = Object.freeze([
  'geometry-audit', 'geometry-human-gate', 'evidence-research', 'evidence-resolution',
  'provenance-audit', 'red-team', 'dossier-human-gate',
  'ready-for-editorial',
  // Where a walk goes when nobody has published directions for it.
  //
  // Not a failure and not a verdict on the trail: Les Marais d'Albens is a
  // real 6.6 km walk with no official page anywhere, and no amount of research
  // will produce one. Calling that `rejected` reads as "ORMA looked and says
  // no", keeps it in the counts of things going wrong, and leaves it eligible
  // to be picked up and paid for again.
  //
  // `imported` is what the public page has always called such a trail. It
  // stays on the site with its terrain, its elevation and its honest badge;
  // the pipeline simply stops spending on it.
  'imported',
  // Verified by hand in Claude against official sources, not by the evidence
  // policy (OPERATING_STANDARD.md, "A walk verified by hand is recorded in the
  // backoffice"). Its own state, never ready-for-editorial: the pipeline did
  // not pass it, and the record says who did.
  'verified-by-hand',
  'rejected', 'blocked',
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
