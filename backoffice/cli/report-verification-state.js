#!/usr/bin/env node
'use strict';

// Read-only. Three of 165 trails are ORMA Verified. That could mean the human
// gates are the constraint, or that few trails ever reach one. Those need
// opposite responses, so measure before changing anything.

const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');

/** Oldest and newest of a set of timestamps, as plain ISO days. */
function jobAge(values){
  const times=values.map(value=>{
    if(!value) return null;
    if(typeof value.toDate==='function') return value.toDate();
    if(value.seconds) return new Date(value.seconds*1000);
    const parsed=new Date(value);
    return Number.isNaN(parsed.valueOf())?null:parsed;
  }).filter(Boolean).sort((a,b)=>a-b);
  if(!times.length) return {oldest:null,newest:null};
  return {oldest:times[0].toISOString().slice(0,10),newest:times[times.length-1].toISOString().slice(0,10)};
}

function tally(list,pick){
  const counts=new Map();
  for(const item of list){const key=pick(item)||'(none)';counts.set(key,(counts.get(key)||0)+1);}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]);
}


// Why the route-guidance gate is refusing, in the agent's own words. Which part
// of a claim failed is the difference between fixing the prompt, the evidence,
// or the gate.
//
// The verdicts come from the gate's own functions rather than from a copy of its
// rules. The copy that used to live here read only the FIRST logistics output
// and called every claim unsourced, while the gate -- which searches every
// output, because a claim settled in an earlier pass is carried forward --
// found them fine. A report that contradicts the thing it reports on is worse
// than no report: on 6 October it said all four claims failed on all seven
// dossiers, none of which was true.
const {supportedLogisticsClaim,VERIFICATION_ROUTE_CLAIMS}=require('../workflows/compile-verified-dossier');

const VERIFICATION_CLAIMS=[...VERIFICATION_ROUTE_CLAIMS];
const ROUTE_GUIDANCE_CLAIMS=[...VERIFICATION_CLAIMS];

/** Every logistics claim with this id, newest last, across all of the outputs. */
function logisticsClaims(item,id){
  return (item.specialistOutputs||[])
    .filter(output=>output.agentId==='logistics')
    .flatMap(output=>(output.result?.claims||[]).filter(claim=>claim.id===id));
}

function routeGuidanceDiagnosis(items){
  return items.filter(item=>item.gateType==='dossier-approval').map(item=>{
    const outputs=(item.specialistOutputs||[]).filter(output=>output.agentId==='logistics');
    // The standing recommendation is the most recent one, not the first.
    const latest=outputs[outputs.length-1]||null;
    // A summarised queue item has had its sources stripped on purpose, with a
    // pointer to the full output. Reporting that as a claim without evidence
    // would invent a failure out of a storage decision.
    const summarised=outputs.some(output=>output.result?.detailWithheld);
    return {
      trailId:item.trailId,
      logisticsRan:Boolean(latest),
      logisticsOutputCount:outputs.length,
      recommendation:latest?.result?.recommendation||null,
      openQuestions:(latest?.result?.openQuestions||[]).slice(0,4),
      detailWithheld:summarised,
      // What the orchestrator itself recorded, so a disagreement with the rows
      // below is visible rather than silent.
      gateBlockingReasons:(item.blockingReasons||[]).slice(0,6),
      claims:ROUTE_GUIDANCE_CLAIMS.map(id=>{
        const found=logisticsClaims(item,id);
        const claim=found[found.length-1];
        const blocksVerification=VERIFICATION_CLAIMS.includes(id);
        // The gate's own verdict, asked of the whole review exactly as
        // compileVerifiedDossier asks it.
        const passes=Boolean(supportedLogisticsClaim(item,id));
        if(!claim)return {id,present:false,blocksVerification,passes};
        return {
          id,present:true,blocksVerification,passes,
          finding:claim.finding,
          hasValue:Boolean(String(claim.proposedValue||'').trim()),
          value:String(claim.proposedValue||'').slice(0,160),
          sources:(claim.sources||[]).map(source=>({
            authority:String(source.authority||'').trim()||null,
            https:/^https:\/\//.test(source.url||''),
            url:String(source.url||'').slice(0,90),
          })),
          sourcesWithheld:summarised&&!(claim.sources||[]).length,
          blockers:claim.blockers||[],
        };
      }),
    };
  });
}


// What the autonomous resolution lane is actually working on. A trail sits in
// evidence-resolution while claims that came back unresolved are retried, up to
// five times each, and every attempt is a model call. Which claims those are
// decides whether that spend is worth making: the ledger is already on the
// orchestration artifact, so naming them costs no extra reads.
function claimsUnderResolution(trails){
  return trails.filter(trail=>trail.state==='evidence-resolution').map(trail=>{
    const ledger=Object.values(trail.claimResolution||{});
    return {
      trailId:trail.trailId,
      claims:ledger.map(entry=>({
        claim:`${entry.agentId}/${entry.claimId}`,
        was:entry.originalFinding||null,
        state:entry.state||null,
        attempts:(entry.attempts||[]).length,
      })).sort((a,b)=>a.claim.localeCompare(b.claim)),
    };
  });
}

/**
 * Every decision a moderator has submitted, and what became of it.
 *
 * A desk approval is not applied where it is made: it writes a queued document
 * and the worker acts on it later. So "nothing is verified" has two very
 * different causes -- nobody has approved anything, or approvals are being
 * submitted and not landing -- and the queue alone cannot tell them apart.
 * One of those needs a person, the other needs a fix.
 */
async function decisionHistory(store){
  if(typeof store.listDossierReviews!=='function') return null;
  const lanes=await Promise.all(['queued','processed','blocked'].map(async status=>{
    try{ return [status,await store.listDossierReviews(status)]; }
    // A lane that cannot be read is not a lane that is empty.
    catch(error){ return [status,null]; }
  }));
  const byStatus={};const all=[];
  lanes.forEach(([status,reviews])=>{
    byStatus[status]=reviews?reviews.length:'unreadable';
    (reviews||[]).forEach(review=>all.push({...review,status}));
  });
  const when=review=>review.processedAt||review.submittedAt;
  const recent=all
    .sort((left,right)=>String(when(right)||'').localeCompare(String(when(left)||'')))
    .slice(0,8)
    .map(review=>({
      status:review.status,
      action:review.action||null,
      candidateId:review.candidateId||null,
      submittedAt:jobAge([review.submittedAt]).oldest,
      // Present only on a blocked one, and the whole reason to look here.
      error:review.error?String(review.error).slice(0,160):undefined,
    }));
  return {
    total:all.length,
    byStatus,
    byAction:tally(all,review=>review.action),
    // A queued decision older than a worker cycle has not been picked up.
    stuckQueued:all.filter(review=>review.status==='queued').length,
    recent,
  };
}

// A pipeline standing still because nobody decided and a pipeline standing
// still because no job can run look identical from the queue counts alone. This
// report is where that question gets asked, so it should carry the answer.
function workerProductivity(health){
  if(!health) return null;
  return {
    status:health.status||null,
    lastProductiveAt:health.lastProductiveAt||null,
    lastSuccessfulAt:health.lastSuccessfulAt||null,
    consecutiveUnproductiveRuns:Number(health.consecutiveUnproductiveRuns||0),
    providerParked:Boolean(health.lastUnproductive?.providerParked),
    reason:health.lastUnproductive?.message||null,
  };
}

async function buildVerificationReport({store}){
  const [orchestration,queue,registry,execution,staging,workerHealth]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.getArtifact('dossier-review-queue'),
    store.getArtifact('orma-verified-registry-live'),
    store.getArtifact('verified-trail-editorial-execution'),
    store.getArtifact('publication-staging'),
    store.getArtifact('worker-health'),
  ]);
  const trails=orchestration?.trails||[];
  const items=(queue?.items||[]).filter(item=>item.state==='awaiting-human');

  // The gate the machine already believes is clean is the one worth talking about.
  const clean=items.filter(item=>item.approvalAllowed);
  const blocked=items.filter(item=>!item.approvalAllowed);

  const jobs=await store.listJobs(['queued','running','ready-for-review','blocked']);
  const specialist=jobs.filter(job=>['trail-verification-specialist','trail-claim-resolution'].includes(job.jobType));

  // stage 'agent-execution-failure' says an agent's job is blocked, and nothing
  // more. failJob is the only path to a blocked job, so every one of these threw
  // three times: provider outages are excluded from the failure budget on
  // purpose and never block. What it does not say is whether the same thing
  // broke seven times or seven different things broke once, and those need
  // opposite responses. lastError is the only field that distinguishes them.
  const blockedJobs=jobs.filter(job=>job.status==='blocked');
  const errorText=job=>String(job.lastError||'(no error recorded)').replace(/\s+/g,' ').trim();

  const decisions=await decisionHistory(store);

  return {
    verified:(registry?.verified||[]).length,
    // Absent entirely until the first approval creates it, so "no registry" and
    // "nothing approved" are the same sentence rather than a missing artifact.
    verifiedRegistryExists:!!registry,
    decisions,
    inPipeline:trails.length,
    byState:tally(trails,trail=>trail.state),
    byStage:tally(trails,trail=>trail.stage),
    awaitingHuman:{
      total:items.length,
      readyToApprove:clean.length,
      needsJudgement:blocked.length,
      byGate:tally(items,item=>item.gateType),
      readyByGate:tally(clean,item=>item.gateType),
    },
    // What is actually stopping the ones the machine will not wave through.
    topBlockingReasons:tally(blocked.flatMap(item=>item.blockingReasons||[]),reason=>String(reason).split(':')[0]).slice(0,12),
    specialistJobs:tally(specialist,job=>`${job.jobType}:${job.status}`),
    agentFailures:{
      total:blockedJobs.length,
      byAgent:tally(blockedJobs,job=>job.agentId||job.jobType||'(unknown)'),
      // One recurring error is a bug to fix. Many different ones are a fragile
      // integration. The shape of this list is the finding.
      byError:tally(blockedJobs,job=>errorText(job).slice(0,120)).slice(0,10),
      // Which lane a failure belongs to. An error from a lane that has since
      // been parked or removed is a job to retire, not a bug to chase.
      byJobType:tally(blockedJobs,job=>job.jobType||'(unknown)'),
      // Age separates a live fault from a graveyard. Without it, a failure
      // from a deleted code path reads exactly like one from this morning.
      oldest:jobAge(blockedJobs.map(job=>job.createdAt).filter(Boolean)).oldest,
      newest:jobAge(blockedJobs.map(job=>job.createdAt).filter(Boolean)).newest,
      // A blocked job should carry the full failure budget. Anything less means
      // it reached 'blocked' by some path failJob does not describe.
      bySystemFailures:tally(blockedJobs,job=>String(job.systemFailures ?? '(unset)')),
      everSawOutage:blockedJobs.filter(job=>Number(job.providerOutages||0)>0).length,
    },
    sampleAgentFailures:blockedJobs.slice(0,8).map(job=>({
      createdAt:jobAge([job.createdAt]).oldest,
      jobId:job.id,agentId:job.agentId||null,jobType:job.jobType||null,
      candidateId:job.candidateId||null,systemFailures:job.systemFailures??null,
      lastError:errorText(job).slice(0,200),
    })),
    downstream:{
      editorialOutputs:(execution?.outputs||[]).length,
      editorialReadyForReview:(execution?.outputs||[]).filter(output=>output.status==='ready-for-review').length,
      publicationStaging:(staging?.items||[]).length,
      publicationReady:(staging?.items||[]).filter(item=>item.state==='ready-for-publication-preview').length,
      // Which of the three ways a staged trail stops short, per trail.
      //
      // "3 staged, 0 ready" is the last number before the website and it named
      // no cause, so the only way to tell a decision waiting on a moderator
      // from a mapping defect was to open the desk. build-publication-staging
      // already records both: missingApprovals when a copy or asset decision
      // has not been made, publicationMappingBlockers when the item cannot be
      // pointed at a website record. Saying which is the difference between
      // "approve six drafts" and "fix a bug".
      publicationStalls:(staging?.items||[]).map(item=>({
        candidateId:item.candidateId||null,
        targetTrailId:item.targetTrailId||null,
        operation:item.operation||null,
        state:item.state||null,
        assetPolicy:item.assetPolicy||null,
        missingApprovals:item.missingApprovals||[],
        publicationMappingBlockers:item.publicationMappingBlockers||[],
        // Whether the copy and asset decisions exist at all, as against
        // existing and saying something other than approve.
        copyDecision:item.sourceApprovals?.copy?.action||null,
        visualDecision:item.sourceApprovals?.visual?.action||null,
      })),
      // An editorial output is written before it is reviewed, so a count of
      // "ready-for-review" says work is waiting without saying for whom --
      // and it keeps saying it after the review happened, because an output's
      // status is not moved when its decision is recorded. Name the job, so a
      // draft genuinely awaiting a reader can be told from one whose decision
      // was made and whose trail is already on the website.
      editorialByStatus:tally((execution?.outputs||[]),output=>String(output.status||'(unset)')),
      editorialOutputJobs:(execution?.outputs||[]).map(output=>({
        jobId:output.jobId||null,status:output.status||null,
        candidateId:output.candidateId||null,
      })),
    },
    routeGuidance:routeGuidanceDiagnosis(items),
    underResolution:claimsUnderResolution(trails),
    sampleReadyToApprove:clean.slice(0,10).map(item=>({trailId:item.trailId,gate:item.gateType})),
    sampleNeedsJudgement:blocked.slice(0,8).map(item=>({trailId:item.trailId,gate:item.gateType,
      reasons:(item.blockingReasons||[]).slice(0,3)})),
    worker:workerProductivity(workerHealth),
  };
}

async function main(options={}){
  const store=options.store||new FirestoreBackofficeStore();
  const report=await buildVerificationReport({store});
  console.log(JSON.stringify(report,null,2));
  const gate=report.awaitingHuman;
  console.log(`\n[verification] ${report.verified} verified · ${report.inPipeline} in the pipeline · ${gate.total} awaiting you.`);
  console.log(`[verification] Of those, ${gate.readyToApprove} are already clean by every automated check and ${gate.needsJudgement} genuinely need your judgement.`);
  const failures=report.agentFailures;
  if(failures.total){
    const [worst]=failures.byError;
    console.log(`[verification] ${failures.total} agent job(s) blocked after the full retry budget, across ${failures.byAgent.length} agent(s).`);
    // One error repeated is a bug with an address. Many different ones are not.
    if(worst) console.log(`[verification] Most common: ${worst[1]}x "${worst[0]}"`);
  }
  // The distinction the queue cannot draw: a decision that was never made
  // against one that was made and did not land.
  const decisions=report.decisions;
  if(decisions){
    if(!decisions.total){
      console.log('[verification] No moderator decision has ever been submitted.');
    }else{
      const parts=Object.entries(decisions.byStatus).map(([status,count])=>`${count} ${status}`);
      console.log(`[verification] ${decisions.total} decision(s) submitted: ${parts.join(' · ')}`);
      if(decisions.stuckQueued){
        console.log(`[verification] ${decisions.stuckQueued} queued and not yet applied by a worker run.`);
      }
      const failed=decisions.recent.filter(entry=>entry.error);
      failed.slice(0,3).forEach(entry =>
        console.log(`[verification] Rejected: ${entry.candidateId||'(no candidate)'} - ${entry.error}`));
    }
  }
  const worker=report.worker;
  if(worker&&worker.consecutiveUnproductiveRuns){
    const days=worker.lastProductiveAt
      ?Math.floor((Date.now()-new Date(worker.lastProductiveAt).getTime())/86400000)
      :null;
    console.log(`[verification] The pipeline is not moving: ${worker.consecutiveUnproductiveRuns} worker run(s) in a row finished no job${days===null?'':`, nothing completed for ${days} day(s)`}.`);
    if(worker.reason) console.log(`[verification] ${worker.reason}`);
  }
  if(!report.verifiedRegistryExists){
    console.log('[verification] No verified registry yet: no approval has completed on this database.');
  }
  console.log('[verification] Nothing was changed.');
  return report;
}

if(require.main===module)main().catch(error=>{console.error(`[verification] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={tally,decisionHistory,routeGuidanceDiagnosis,buildVerificationReport,main};
