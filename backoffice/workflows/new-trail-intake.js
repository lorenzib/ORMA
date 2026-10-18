'use strict';

const { startLiveTrailCampaign } = require('./start-live-trail-campaign');

function candidateToTrail(candidate){
  if(!candidate?.id||!Number.isInteger(candidate.osmRelation))throw new Error('New Trail candidate requires an OSM relation');
  return {
    id:candidate.id,name:candidate.name,area:candidate.region,region:candidate.region,
    lat:candidate.center?.[1]??null,lng:candidate.center?.[0]??null,distance:candidate.distanceKm,
    path:[],curated:false,osmRelation:candidate.osmRelation,waymarkedtrails:candidate.sourceUrl,
    source:candidate.sourceUrl,sourceLinks:[{label:'Scouting source',url:candidate.sourceUrl}],
    intakeStatus:'selected-for-verification',publicRecordPresent:false,
  };
}

function selectedNewTrails(packet, review){
  const selected=new Set((review?.decisions||[]).filter(item=>item.action==='send-to-verification').map(item=>item.candidateId));
  return (packet?.candidates||[]).filter(item=>selected.has(item.id)).map(candidateToTrail);
}

/**
 * A walk that cannot be published is not worth paying to verify.
 *
 * A scouted candidate exists only here: an id, a name, an OSM relation and an
 * empty path, written to Firestore and never into `data/`. Publication
 * restates nine fields from the catalogue record -- how far, how long, what
 * ground, where it starts, what water is on it -- and for such a trail there
 * is no record to restate, so it stops at the mapping gate for ever.
 *
 * It stopped there having been paid for. The cartographer is free, but the
 * research agents, the copywriter and the visual director are not, and all of
 * them ran before anything noticed the walk could never reach a page.
 *
 * So a candidate the catalogue does not hold is kept back and named, rather
 * than admitted. Nothing is dropped and nothing is charged: it waits for the
 * import that would give it a record, which is the step the scouting lane is
 * missing, and the summary says how many are waiting and why.
 */
function heldForImport(trails, catalogue){
  if(!catalogue)return {admit:trails,held:[]};
  const known=new Set(catalogue.map(trail=>String(trail.id)));
  return {
    admit:trails.filter(trail=>known.has(String(trail.id))),
    held:trails.filter(trail=>!known.has(String(trail.id)))
      .map(trail=>({id:trail.id,name:trail.name,
        reason:'not in the catalogue: publication restates a record this walk has not got'})),
  };
}

async function admitNewTrailIntake(store, packet, review, options={}){
  const trails=selectedNewTrails(packet,review);const at=options.at||new Date().toISOString();
  // Absent rather than empty: a caller that passed no catalogue is not saying
  // the catalogue is empty, and holding every candidate back on that reading
  // would turn a missing argument into a silent stop.
  const {admit,held}=heldForImport(trails,options.productionTrails);
  const artifact={contractVersion:'1.0.0',generatedAt:at,publicMutationAllowed:false,candidates:admit,
    ...(held.length?{heldForImport:held}:{})};
  await store.setArtifact('new-trail-intake',artifact,{source:'CEO New Trails review'});
  const summary={selected:trails.length,...(held.length?{heldForImport:held.length}:{})};
  if(!admit.length)return {artifact,jobIds:[],held,summary};
  const result=await startLiveTrailCampaign(store,admit,{at,limit:admit.length,capacity:options.capacity||5});
  return {artifact,jobIds:result.jobIds,held,
    summary:{...summary,admitted:result.jobIds.length,waiting:admit.length-result.jobIds.length}};
}

module.exports={candidateToTrail,heldForImport,selectedNewTrails,admitNewTrailIntake};
