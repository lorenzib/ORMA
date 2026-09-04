'use strict';

function applyVerifiedTrailOverrides(trails, artifact){
  const next = trails.map(trail => ({ ...trail }));
  for(const entry of artifact?.trails || []){
    const isFullTrailVerification = entry && entry.fields && entry.fields.ormaVerified === true;
    const isRouteRefVerification = entry && entry.verificationScope === 'routeRefs'
      && Array.isArray(entry.fields && entry.fields.routeRefSegments)
      && entry.fields.routeRefSegments.length > 0;
    const guidance=entry && entry.fields && entry.fields.routeNumberGuidance;
    const isRouteGuidanceVerification = entry && entry.verificationScope === 'routeGuidance'
      && guidance && ['numbered','landmarks'].includes(guidance.mode)
      && ['start','sequence','switches'].every(field=>typeof guidance[field]==='string'&&guidance[field].trim())
      && Array.isArray(guidance.sources)&&guidance.sources.some(source=>/^https:\/\//.test(source?.url||'')&&source?.reviewedAt);
    if(!entry || typeof entry.id !== 'string' || !entry.fields || (!isFullTrailVerification && !isRouteRefVerification && !isRouteGuidanceVerification)){
      throw new Error('Verified trail override must contain an id and full-trail, route-reference or route-guidance verification');
    }
    const index = next.findIndex(trail => trail.id === entry.id);
    if(index >= 0) next[index] = { ...next[index], ...entry.fields, id:entry.id };
    else next.push({ id:entry.id, ...entry.fields });
  }
  return next;
}

module.exports = { applyVerifiedTrailOverrides };
