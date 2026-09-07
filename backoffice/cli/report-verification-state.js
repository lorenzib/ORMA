#!/usr/bin/env node
'use strict';

// Read-only. Three of 165 trails are ORMA Verified. That could mean the human
// gates are the constraint, or that few trails ever reach one. Those need
// opposite responses, so measure before changing anything.

const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');

function tally(list,pick){
  const counts=new Map();
  for(const item of list){const key=pick(item)||'(none)';counts.set(key,(counts.get(key)||0)+1);}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]);
}

async function buildVerificationReport({store}){
  const [orchestration,queue,registry,execution,staging]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.getArtifact('dossier-review-queue'),
    store.getArtifact('orma-verified-registry-live'),
    store.getArtifact('verified-trail-editorial-execution'),
    store.getArtifact('publication-staging'),
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

  return {
    verified:(registry?.verified||[]).length,
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
      // A blocked job should carry the full failure budget. Anything less means
      // it reached 'blocked' by some path failJob does not describe.
      bySystemFailures:tally(blockedJobs,job=>String(job.systemFailures ?? '(unset)')),
      everSawOutage:blockedJobs.filter(job=>Number(job.providerOutages||0)>0).length,
    },
    sampleAgentFailures:blockedJobs.slice(0,8).map(job=>({
      jobId:job.id,agentId:job.agentId||null,jobType:job.jobType||null,
      candidateId:job.candidateId||null,systemFailures:job.systemFailures??null,
      lastError:errorText(job).slice(0,200),
    })),
    downstream:{
      editorialOutputs:(execution?.outputs||[]).length,
      editorialReadyForReview:(execution?.outputs||[]).filter(output=>output.status==='ready-for-review').length,
      publicationStaging:(staging?.items||[]).length,
      publicationReady:(staging?.items||[]).filter(item=>item.state==='ready-for-publication-preview').length,
    },
    sampleReadyToApprove:clean.slice(0,10).map(item=>({trailId:item.trailId,gate:item.gateType})),
    sampleNeedsJudgement:blocked.slice(0,8).map(item=>({trailId:item.trailId,gate:item.gateType,
      reasons:(item.blockingReasons||[]).slice(0,3)})),
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
  console.log('[verification] Nothing was changed.');
  return report;
}

if(require.main===module)main().catch(error=>{console.error(`[verification] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={tally,buildVerificationReport,main};
