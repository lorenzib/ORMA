'use strict';

function applyVerifiedTrailOverrides(trails, artifact){
  const next = trails.map(trail => ({ ...trail }));
  for(const entry of artifact?.trails || []){
    if(!entry || typeof entry.id !== 'string' || !entry.fields || entry.fields.ormaVerified !== true){
      throw new Error('Verified trail override must contain an id and ORMA-verified fields');
    }
    const index = next.findIndex(trail => trail.id === entry.id);
    if(index >= 0) next[index] = { ...next[index], ...entry.fields, id:entry.id };
    else next.push({ id:entry.id, ...entry.fields });
  }
  return next;
}

module.exports = { applyVerifiedTrailOverrides };
