'use strict';

/**
 * Why one trail's line was rejected.
 *
 * The gate records the blocker's name and nothing else, and once the evidence
 * policy has decided a gate the trail leaves the queue -- so `gate-evidence`
 * and `dump-dossier` both find nothing, and the measurement that produced the
 * verdict is unreachable. osm-14864704 was rejected for `not-closed-loop` with
 * a published line whose ends are 13 m apart, and there was no way to see what
 * the check had actually measured.
 *
 * The cartographer stores its assessment on every pass, so the measurement is
 * already there. This finds the latest one for a trail and reads it.
 */

const CARTOGRAPHER=/-cartographer-\d+-/;

/** The newest cartographer job for a trail, by the timestamp in its own id. */
function latestCartographerJobId(trail){
  return [...(trail?.jobIds||[])]
    .filter(id=>CARTOGRAPHER.test(String(id)))
    .sort()
    .pop()||null;
}

function findTrail(orchestration,trailId){
  const wanted=String(trailId);
  return (orchestration?.trails||[]).find(trail=>
    String(trail.trailId)===wanted||String(trail.candidateId)===wanted)||null;
}

/**
 * What the check measured, in the terms the blocker is named in. `isClosed` is
 * the verdict, `closureDistanceM` is the gap it measured, and `circular` says
 * whether the closure test applied at all -- an undeclared route is assumed
 * circular, so a route that is not one is faulted for not closing.
 */
function readGeometryAudit(output){
  const assessment=output?.assessment||null;
  if(!assessment)return null;
  return {
    status:assessment.status||null,
    routeShape:assessment.routeShape||null,
    circular:assessment.circular,
    isClosed:assessment.isClosed,
    closureDistanceM:assessment.closureDistanceM,
    distanceKm:assessment.distanceKm,
    maxSegmentM:assessment.maxSegmentM,
    pointCount:assessment.pointCount,
    issues:assessment.issues||[],
    routeConformance:output?.routeConformance||null,
  };
}

module.exports={CARTOGRAPHER,latestCartographerJobId,findTrail,readGeometryAudit};
