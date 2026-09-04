'use strict';

const {startLiveTrailCampaign}=require('./start-live-trail-campaign');

const DEFAULT_INTERVAL_HOURS=24;
const DEFAULT_RETRY_MINUTES=60;

function dateMs(value){
  if(!value)return 0;
  if(typeof value.toDate==='function')return value.toDate().getTime();
  if(value.seconds)return Number(value.seconds)*1000;
  const parsed=new Date(value).getTime();return Number.isNaN(parsed)?0:parsed;
}

function nextAt(at,hours){return new Date(dateMs(at)+hours*60*60*1000).toISOString();}
function retryAt(at,minutes){return new Date(dateMs(at)+minutes*60*1000).toISOString();}

function campaignEligibility(previous,options={}){
  const at=options.at||new Date().toISOString();const force=options.force===true;
  const intervalHours=Number(options.intervalHours||DEFAULT_INTERVAL_HOURS);
  const eligibleAt=previous?.nextEligibleAt||
    (previous?.lastSuccessfulAt?nextAt(previous.lastSuccessfulAt,intervalHours):at);
  return {at,force,eligibleAt,due:force||dateMs(at)>=dateMs(eligibleAt)};
}

function identity(options={}){
  return {trigger:options.trigger||'worker-catch-up',workflowRunUrl:options.workflowRunUrl||null,runId:options.runId||null};
}

async function runScheduledTrailCampaign(store,trails,options={}){
  const previous=await store.getArtifact('trail-campaign-health');
  const eligibility=campaignEligibility(previous,options);const runIdentity=identity(options);
  if(options.enabled!==true&&!eligibility.force)return {status:'disabled',due:false,nextEligibleAt:eligibility.eligibleAt};
  if(!eligibility.due)return {status:'not-due',due:false,nextEligibleAt:eligibility.eligibleAt,lastSuccessfulAt:previous?.lastSuccessfulAt||null};
  const started={contractVersion:'1.0.0',status:'running',startedAt:eligibility.at,completedAt:null,
    lastSuccessfulAt:previous?.lastSuccessfulAt||null,nextEligibleAt:eligibility.at,...runIdentity,
    lastResult:previous?.lastResult||null,lastFailure:previous?.lastFailure||null,
    recentRuns:[...(previous?.recentRuns||[])].slice(-19),publicMutationAllowed:false};
  await store.setArtifact('trail-campaign-health',started,{status:'running',runId:runIdentity.runId});
  try{
    const result=await startLiveTrailCampaign(store,trails,{at:eligibility.at,limit:options.limit||5,capacity:options.capacity||5});
    const completedAt=options.completedAt||new Date().toISOString();const receipt={outcome:'success',startedAt:eligibility.at,completedAt,
      admitted:result.jobIds.length,remainingQueueable:result.campaign.summary.remainingQueueable,
      routeNumberGuidanceVerified:result.campaign.summary.routeNumberGuidanceVerified,
      routeNumberGuidanceOutstanding:result.campaign.summary.routeNumberGuidanceOutstanding,...runIdentity};
    const health={...started,status:'healthy',completedAt,lastSuccessfulAt:completedAt,
      nextEligibleAt:nextAt(completedAt,Number(options.intervalHours||DEFAULT_INTERVAL_HOURS)),lastResult:receipt,
      recentRuns:[...started.recentRuns,receipt].slice(-20)};
    await store.setArtifact('trail-campaign-health',health,{status:'healthy',runId:runIdentity.runId});
    return {status:'completed',due:true,jobIds:result.jobIds,summary:result.summary,campaign:result.campaign,nextEligibleAt:health.nextEligibleAt};
  }catch(error){
    const completedAt=options.completedAt||new Date().toISOString();const message=String(error?.message||error).slice(0,2000);
    const receipt={outcome:'failure',startedAt:eligibility.at,completedAt,message,...runIdentity};
    const health={...started,status:'failed',completedAt,nextEligibleAt:retryAt(completedAt,Number(options.retryMinutes||DEFAULT_RETRY_MINUTES)),
      lastFailure:receipt,recentRuns:[...started.recentRuns,receipt].slice(-20)};
    await store.setArtifact('trail-campaign-health',health,{status:'failed',runId:runIdentity.runId});
    throw error;
  }
}

module.exports={DEFAULT_INTERVAL_HOURS,DEFAULT_RETRY_MINUTES,dateMs,campaignEligibility,runScheduledTrailCampaign};
