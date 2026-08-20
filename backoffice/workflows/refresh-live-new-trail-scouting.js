'use strict';

const {planNewTrailScouting}=require('./plan-new-trail-scouting');

function runIdentity(options={}){
  return {runId:options.runId||null,workflowRunUrl:options.workflowRunUrl||null,trigger:options.trigger||'scheduled'};
}

async function refreshLiveNewTrailScouting(store,sources,trails,options={}){
  const at=options.at||new Date().toISOString();const identity=runIdentity(options);
  try{
    const [orchestration,previous,review]=await Promise.all([store.getArtifact('trail-orchestration'),store.getArtifact('new-trail-scouting'),store.getArtifact('new-trail-scouting-review')]);
    const excludedCandidateIds=(orchestration?.trails||[]).map(trail=>trail.candidateId||trail.trailId);
    const fresh=planNewTrailScouting(sources,trails,{at,limit:options.limit||25,excludedCandidateIds});
    const decided=new Set((review?.decisions||[]).map(decision=>decision.candidateId));const excluded=new Set(excludedCandidateIds);
    const merged=new Map((previous?.candidates||[]).filter(candidate=>!decided.has(candidate.id)&&!excluded.has(candidate.id)).map(candidate=>[candidate.id,candidate]));
    for(const candidate of fresh.candidates)merged.set(candidate.id,candidate);
    const candidates=[...merged.values()].sort((a,b)=>(a.priority||999)-(b.priority||999)).map((candidate,index)=>({...candidate,priority:index+1}));
    const packet={...fresh,candidates,summary:{candidates:candidates.length,existingArea:candidates.filter(item=>item.expansionTier==='existing-area').length,adjacentArea:candidates.filter(item=>item.expansionTier==='adjacent-area').length,newArea:candidates.filter(item=>item.expansionTier==='new-area').length}};
    const status={contractVersion:'1.0.0',status:'healthy',checkedAt:at,...identity,summary:packet.summary,
      nextScheduledAt:new Date(new Date(at).getTime()+7*24*60*60*1000).toISOString(),publicMutationAllowed:false};
    await Promise.all([
      store.setArtifact('new-trail-scouting',packet,{status:'awaiting-review',runId:identity.runId}),
      store.setArtifact('new-trail-scouting-status',status,{status:'healthy',runId:identity.runId}),
    ]);
    return {packet,status};
  }catch(error){
    const status={contractVersion:'1.0.0',status:'failed',checkedAt:at,...identity,
      failureMessage:String(error?.message||error).slice(0,2000),retryable:true,publicMutationAllowed:false};
    await store.setArtifact('new-trail-scouting-status',status,{status:'failed',runId:identity.runId});throw error;
  }
}

module.exports={runIdentity,refreshLiveNewTrailScouting};
