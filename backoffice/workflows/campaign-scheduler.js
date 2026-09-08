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

// The campaign is meant to run once a day, shortly after the Firestore quota
// resets, which is why its cron sits at 09:30 Europe/Rome. Setting the next
// eligibility to "24 hours from now" broke that: a run at 12:12 pushed the next
// one to 12:12, so the 09:30 cron was four hours early and skipped the day
// entirely. Two paths can run the campaign -- the cron and the worker -- so
// whenever the worker won, the following morning was lost.
//
// Eligibility therefore lands on the next campaign window rather than a rolling
// interval, so a fixed daily cron always finds it due no matter who ran it last.
const CAMPAIGN_TIME_ZONE='Europe/Rome';
const CAMPAIGN_HOUR=9;
const CAMPAIGN_MINUTE=30;

function zoneOffsetMs(ms,timeZone){
  const parts={};
  for(const part of new Intl.DateTimeFormat('en-US',{timeZone,hour12:false,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})
    .formatToParts(new Date(ms))) if(part.type!=='literal') parts[part.type]=part.value;
  return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),
    Number(parts.hour)%24,Number(parts.minute),Number(parts.second))-ms;
}

// The instant of a wall-clock time in a zone, corrected once for that zone's
// offset at the guessed instant. Good across DST changes for a 09:30 target.
function instantAt(year,month,day,hour,minute,timeZone){
  const guess=Date.UTC(year,month-1,day,hour,minute,0);
  return guess-zoneOffsetMs(guess,timeZone);
}

function nextCampaignWindow(at,options={}){
  const timeZone=options.timeZone||CAMPAIGN_TIME_ZONE;
  const hour=Number.isInteger(options.hour)?options.hour:CAMPAIGN_HOUR;
  const minute=Number.isInteger(options.minute)?options.minute:CAMPAIGN_MINUTE;
  const from=dateMs(at)||Date.now();
  const parts={};
  for(const part of new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date(from))) if(part.type!=='literal') parts[part.type]=part.value;
  let candidate=instantAt(Number(parts.year),Number(parts.month),Number(parts.day),hour,minute,timeZone);
  // Strictly after the run that just finished, so a campaign completing during
  // its own window does not immediately become eligible again.
  if(candidate<=from) candidate=instantAt(Number(parts.year),Number(parts.month),Number(parts.day)+1,hour,minute,timeZone);
  return new Date(candidate).toISOString();
}
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
    const result=await startLiveTrailCampaign(store,trails,
      {at:eligibility.at,limit:options.limit||5,capacity:options.capacity||5,queueCapacity:options.queueCapacity});
    const completedAt=options.completedAt||new Date().toISOString();const receipt={outcome:'success',startedAt:eligibility.at,completedAt,
      admitted:result.jobIds.length,remainingQueueable:result.campaign.summary.remainingQueueable,
      routeNumberGuidanceVerified:result.campaign.summary.routeNumberGuidanceVerified,
      routeNumberGuidanceOutstanding:result.campaign.summary.routeNumberGuidanceOutstanding,...runIdentity};
    const health={...started,status:'healthy',completedAt,lastSuccessfulAt:completedAt,
      nextEligibleAt:nextCampaignWindow(completedAt,options),lastResult:receipt,
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

module.exports={nextCampaignWindow,CAMPAIGN_TIME_ZONE,CAMPAIGN_HOUR,CAMPAIGN_MINUTE,DEFAULT_INTERVAL_HOURS,DEFAULT_RETRY_MINUTES,dateMs,campaignEligibility,runScheduledTrailCampaign};
