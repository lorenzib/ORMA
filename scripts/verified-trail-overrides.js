'use strict';

function applyVerifiedTrailOverrides(trails, artifact){
  const next = trails.map(trail => ({ ...trail }));
  for(const entry of artifact?.trails || []){
    // The seal reaches the record through one door only: a full verification,
    // which declares no narrower scope. An entry that names a scope and also
    // claims `ormaVerified` would otherwise be waved through here by the full
    // check while reading, to anybody looking at the file, as the narrow thing
    // its label says it is.
    const isFullTrailVerification = entry && entry.fields && entry.fields.ormaVerified === true
      && !entry.verificationScope;
    const isRouteRefVerification = entry && entry.verificationScope === 'routeRefs'
      && Array.isArray(entry.fields && entry.fields.routeRefSegments)
      && entry.fields.routeRefSegments.length > 0;
    const guidance=entry && entry.fields && entry.fields.routeNumberGuidance;
    // A source that names where it is and when it was read. `reviewedAt` is
    // what a hand-written entry carries; `accessedAt` is what the pipeline
    // carries, and for an OpenStreetMap relation it is the relation's own
    // timestamp -- the moment the thing being cited last changed, which is a
    // better date than the moment somebody looked at it.
    const dated = source => /^https:\/\//.test(source?.url||'') && Boolean(source?.reviewedAt||source?.accessedAt);
    // Which rung established each answer. Absent on an entry written before the
    // field existed, and then the source requirement below stands alone, as it
    // always did.
    const RUNGS=['agent-evidence','route-relations','orma-record'];
    const establishedBy = guidance && guidance.establishedBy;
    const rungs = establishedBy
      ? ['start','status','sequence','switches'].map(field=>establishedBy[field])
      : [];
    const rungsNamed = !establishedBy || rungs.every(rung=>RUNGS.includes(rung));
    // ORMA's own record is a rung with nothing outside ORMA to cite.
    //
    // Requiring a dated external source of every scoped publication would
    // permanently exclude the walks this rung exists for: an unnumbered village
    // loop whose start and sequence ORMA established from the line it recorded
    // and published has no operator's page to link, and never will. The answer
    // itself says so in the sentence a reader sees. What cannot be allowed is an
    // empty source list meaning nothing in particular -- so an entry citing
    // nothing has to state that every answer is ORMA's own, and an entry whose
    // answers rest on the map or on an agent's reading still has to cite them.
    const citesOnlyOrma = Boolean(establishedBy) && rungs.every(rung=>rung==='orma-record');
    const guidanceIsEstablished = Boolean(guidance)
      && ['numbered','landmarks'].includes(guidance.mode)
      && ['start','sequence','switches'].every(field=>typeof guidance[field]==='string'&&guidance[field].trim())
      && rungsNamed
      && (citesOnlyOrma || (Array.isArray(guidance.sources) && guidance.sources.some(dated)));
    const isRouteGuidanceVerification = entry && entry.verificationScope === 'routeGuidance' && guidanceIsEstablished;
    // A publication whose badge reads "Reviewed by ORMA", not "Verified".
    //
    // The seal is earned on all eleven checks, and six of them are safety facts
    // a specialist has to ask about. A walk whose directions ORMA established
    // from the map and its own record has those four answers and none of the
    // six, and holding its copy, its start point and its route numbers off the
    // page until somebody pays for the six keeps work the reader wants out of
    // their hands for no gain in honesty: the badge already says reviewed, and
    // every safety caveat already stands because no category is recorded.
    //
    // So this scope exists, and it must state what it is short of. The
    // graduation it carries lists what was completed of the eleven, and the
    // entry has to declare `ormaVerified: false` -- an unearned seal cannot
    // reach the record through this door even by accident.
    const graduation = entry && entry.fields && entry.fields.graduation;
    const isRouteReviewedPublication = entry && entry.verificationScope === 'routeReviewed'
      && entry.fields.ormaVerified === false
      && guidanceIsEstablished
      && graduation && graduation.status === 'in-progress'
      && Array.isArray(graduation.required) && Array.isArray(graduation.completed)
      && graduation.completed.length > 0
      && graduation.completed.length < graduation.required.length;
    // A walk that does not return to its start is not broken, it is a different
    // shape. Declaring that is a human statement about the trail, recorded the
    // same way as any other verified fact, so the geometry check stops faulting
    // it for failing to close and every later run reads the same answer.
    const shape = entry && entry.fields && entry.fields.routeShape;
    const isRouteShapeVerification = entry && entry.verificationScope === 'routeShape'
      && ['loop','out-and-back','point-to-point'].includes(shape)
      && typeof entry.fields.routeShapeNote === 'string' && entry.fields.routeShapeNote.trim().length > 0;
    // Where a walk is best begun is a human call too. The import pipeline
    // anchors a start to the nearest mapped access point within 400 m of the
    // route, which on a plateau loop can only ever be a lift's top station;
    // the road, parking and bus stop a kilometre below never qualify. A
    // scoped start point names that real access without claiming anything
    // else about the trail, and must say where the knowledge came from.
    const start = entry && entry.fields && entry.fields.startPoint;
    const isStartPointVerification = entry && entry.verificationScope === 'startPoint'
      && start && Number.isFinite(start.lat) && Number.isFinite(start.lng)
      && typeof start.label === 'string' && start.label.trim().length > 0
      && Array.isArray(entry.sources) && entry.sources.some(source=>/^https:\/\//.test(source?.url||'')&&source?.reviewedAt);
    if(!entry || typeof entry.id !== 'string' || !entry.fields || (!isFullTrailVerification && !isRouteRefVerification && !isRouteGuidanceVerification && !isRouteReviewedPublication && !isRouteShapeVerification && !isStartPointVerification)){
      throw new Error('Verified trail override must contain an id and full-trail, route-reference, route-guidance, route-reviewed, route-shape or start-point verification');
    }
    const index = next.findIndex(trail => trail.id === entry.id);
    if(index >= 0) next[index] = { ...next[index], ...entry.fields, id:entry.id };
    else next.push({ id:entry.id, ...entry.fields });
  }
  return next;
}

module.exports = { applyVerifiedTrailOverrides };
