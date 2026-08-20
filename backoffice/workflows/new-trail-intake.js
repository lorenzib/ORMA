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

async function admitNewTrailIntake(store, packet, review, options={}){
  const trails=selectedNewTrails(packet,review);const at=options.at||new Date().toISOString();
  const artifact={contractVersion:'1.0.0',generatedAt:at,publicMutationAllowed:false,candidates:trails};
  await store.setArtifact('new-trail-intake',artifact,{source:'CEO New Trails review'});
  if(!trails.length)return {artifact,jobIds:[],summary:{selected:0}};
  const result=await startLiveTrailCampaign(store,trails,{at,limit:trails.length,capacity:options.capacity||8});
  return {artifact,jobIds:result.jobIds,summary:{selected:trails.length,admitted:result.jobIds.length,waiting:trails.length-result.jobIds.length}};
}

module.exports={candidateToTrail,selectedNewTrails,admitNewTrailIntake};
