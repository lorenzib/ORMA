'use strict';

function applyVerifiedTrailOverrides(trails, artifact){
  const next = trails.map(trail => ({ ...trail }));
  for(const entry of artifact?.trails || []){
    const isFullTrailVerification = entry && entry.fields && entry.fields.ormaVerified === true;
    const isRouteRefVerification = entry && entry.verificationScope === 'routeRefs'
      && Array.isArray(entry.fields && entry.fields.routeRefSegments)
      && entry.fields.routeRefSegments.length > 0;
    if(!entry || typeof entry.id !== 'string' || !entry.fields || (!isFullTrailVerification && !isRouteRefVerification)){
      throw new Error('Verified trail override must contain an id and full-trail or route-reference verification');
    }
    const index = next.findIndex(trail => trail.id === entry.id);
    if(index >= 0) next[index] = { ...next[index], ...entry.fields, id:entry.id };
    else next.push({ id:entry.id, ...entry.fields });
  }
  return next;
}

module.exports = { applyVerifiedTrailOverrides };
