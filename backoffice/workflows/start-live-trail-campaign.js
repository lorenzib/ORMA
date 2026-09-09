'use strict';

const {planCatalogueCampaign}=require('./plan-catalogue-campaign');
const {summarize}=require('./build-live-orchestration');
const {validateTrailOrchestration}=require('../contracts/trail-orchestration-v1');

const DEFAULT_CAMPAIGN_LIMIT=10;
// How many trails agents may be working at once. This is the credit and quota
// budget, and it is the one to keep tight.
const DEFAULT_TRAIL_CAPACITY=15;
// How many may be waiting on a moderator. Holding one costs nothing, so this is
// far larger; it exists so a backlog eventually stops intake rather than growing
// without limit past what the review queue artifact can hold.
const DEFAULT_GATE_CAPACITY=40;

const TERMINAL_STATES=new Set(['ready-for-editorial','rejected','blocked']);
const GATE_STATES=new Set(['geometry-human-gate','dossier-human-gate']);
// Anything not terminal and not parked is treated as agent work, so a state this
// list has not met yet consumes the tight budget rather than silently freeing it.
function agentWorking(state){return !TERMINAL_STATES.has(state)&&!GATE_STATES.has(state);}

function liveJob(job){
  return {...job,id:`trail-verification-${job.candidateId}-cartographer-1`,
    jobType:'trail-verification-specialist',attempt:1,publicMutationAllowed:false};
}

async function startLiveTrailCampaign(store,trails,options={}){
  const at=options.at||new Date().toISOString();const limit=options.limit||DEFAULT_CAMPAIGN_LIMIT;const capacity=options.capacity||DEFAULT_TRAIL_CAPACITY;
  const queueCapacity=options.queueCapacity||DEFAULT_GATE_CAPACITY;
  const existing=await store.getArtifact('trail-orchestration')||{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[]};
  const excluded=existing.trails.map(trail=>trail.trailId);
  // Two budgets, because they protect different things. A trail being researched
  // costs model credits and Firestore reads on every pass; a trail parked at a
  // human gate costs neither, and only needs a moderator. Counting them the same
  // way is what stalled intake: fifteen slots, five of them held by trails whose
  // only remaining need was a decision, and 145 trails that could not enter.
  const active=existing.trails.filter(trail=>agentWorking(trail.state)).length;
  const parked=existing.trails.filter(trail=>GATE_STATES.has(trail.state)).length;
  // The gate budget is backpressure, not throughput: admitting more trails when
  // the moderator already has a backlog helps nobody, and the review queue has
  // its own byte ceiling.
  const available=Math.max(0,Math.min(capacity-active,queueCapacity-parked));
  const campaign=planCatalogueCampaign(trails,{at,jobLimit:Math.max(1,Math.min(limit,available||1)),excludedTrailIds:excluded});
  if(!available){campaign.summary.remainingQueueable+=campaign.jobs.length;campaign.summary.jobsCreated=0;campaign.selectedTrailIds=[];campaign.jobs=[];}
  const byId=new Map(campaign.items.map(item=>[item.trailId,item]));const created=[];
  for(const planned of campaign.jobs){
    const job=liveJob(planned);const item=byId.get(job.candidateId);
    if(typeof store.putJobIfAbsent==='function')await store.putJobIfAbsent(job);else await store.putJob(job);
    created.push(job);
    existing.trails.push({trailId:job.candidateId,candidateId:job.candidateId,trailName:item?.name||job.candidateId,
      state:'geometry-audit',stage:'route-identity-and-geometry',priorityScore:item?.priorityScore||0,
      sourceTrail:{origin:item?.origin||null,externalRelationId:item?.externalRelationId||null,baselineBlockers:item?.baselineBlockers||[]},
      attempts:{cartographer:1},resolutionAttempts:{},jobIds:[job.id],currentJobId:job.id,gate:null,latestOutputRef:null,
      blockers:[],publicMutationAllowed:false,updatedAt:at});
  }
  existing.generatedAt=at;existing.lastCampaign={generatedAt:at,limit,capacity,queueCapacity,activeBefore:active,parkedBefore:parked,selectedTrailIds:campaign.selectedTrailIds,
    remainingQueueable:campaign.summary.remainingQueueable};existing.summary=summarize(existing.trails);
  const errors=validateTrailOrchestration(existing);if(errors.length)throw new Error(errors.join('; '));
  await store.setArtifact('trail-orchestration',existing,{lastCampaignAt:at});
  return {campaign,jobIds:created.map(job=>job.id),summary:existing.summary};
}

module.exports={DEFAULT_GATE_CAPACITY,TERMINAL_STATES,GATE_STATES,agentWorking,DEFAULT_CAMPAIGN_LIMIT,DEFAULT_TRAIL_CAPACITY,liveJob,startLiveTrailCampaign};
