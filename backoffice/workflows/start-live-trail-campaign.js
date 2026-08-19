'use strict';

const {planCatalogueCampaign}=require('./plan-catalogue-campaign');
const {summarize}=require('./build-live-orchestration');
const {validateTrailOrchestration}=require('../contracts/trail-orchestration-v1');

function liveJob(job,at){
  const suffix=at.replace(/[:.]/g,'-');
  return {...job,id:`trail-verification-${job.candidateId}-cartographer-1-${suffix}`,
    jobType:'trail-verification-specialist',attempt:1,publicMutationAllowed:false};
}

async function startLiveTrailCampaign(store,trails,options={}){
  const at=options.at||new Date().toISOString();const limit=options.limit||5;const capacity=options.capacity||5;
  const existing=await store.getArtifact('trail-orchestration')||{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[]};
  const excluded=existing.trails.map(trail=>trail.trailId);
  const terminal=new Set(['ready-for-editorial','rejected','blocked']);
  const active=existing.trails.filter(trail=>!terminal.has(trail.state)).length;const available=Math.max(0,capacity-active);
  const campaign=planCatalogueCampaign(trails,{at,jobLimit:Math.max(1,Math.min(limit,available||1)),excludedTrailIds:excluded});
  if(!available){campaign.summary.remainingQueueable+=campaign.jobs.length;campaign.summary.jobsCreated=0;campaign.selectedTrailIds=[];campaign.jobs=[];}
  const byId=new Map(campaign.items.map(item=>[item.trailId,item]));const created=[];
  for(const planned of campaign.jobs){
    const job=liveJob(planned,at);const item=byId.get(job.candidateId);await store.putJob(job);created.push(job);
    existing.trails.push({trailId:job.candidateId,candidateId:job.candidateId,trailName:item?.name||job.candidateId,
      state:'geometry-audit',stage:'route-identity-and-geometry',priorityScore:item?.priorityScore||0,
      sourceTrail:{origin:item?.origin||null,externalRelationId:item?.externalRelationId||null,baselineBlockers:item?.baselineBlockers||[]},
      attempts:{cartographer:1},resolutionAttempts:{},jobIds:[job.id],currentJobId:job.id,gate:null,latestOutputRef:null,
      blockers:[],publicMutationAllowed:false,updatedAt:at});
  }
  existing.generatedAt=at;existing.lastCampaign={generatedAt:at,limit,capacity,activeBefore:active,selectedTrailIds:campaign.selectedTrailIds,
    remainingQueueable:campaign.summary.remainingQueueable};existing.summary=summarize(existing.trails);
  const errors=validateTrailOrchestration(existing);if(errors.length)throw new Error(errors.join('; '));
  await store.setArtifact('trail-orchestration',existing,{lastCampaignAt:at});
  return {campaign,jobIds:created.map(job=>job.id),summary:existing.summary};
}

module.exports={liveJob,startLiveTrailCampaign};
