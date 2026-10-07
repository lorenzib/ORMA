#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { runLiveBackofficeWorker } = require('../workflows/run-live-backoffice-worker');
const { providerOutage } = require('../services/provider-outage');
const { summariseWorkAttempted, workOutcome, workMessage } = require('../workflows/worker-productivity');

function positiveInteger(value,fallback){
  const parsed=Number.parseInt(value,10);
  return Number.isInteger(parsed)&&parsed>0?parsed:fallback;
}

// Named so a retired lane cannot leave a dangling read here: the worker's result
// shape changed underneath this check once already, and an undefined lane threw
// before the exit code could be set.
const REVIEW_LANES = Object.freeze(['reviews', 'routeReviews', 'routeAdmissions', 'gateDispatches', 'dossierReviews', 'publications']);

function blockedLanes(result = {}){
  return REVIEW_LANES.filter(lane => (result[lane] || []).some(item => item.status === 'blocked'))
    .concat((result.communityHazards?.vetted || [])
      .some(item => item.status === 'vetting-failed' && !providerOutage(item.error)) ? ['communityHazards'] : []);
}

// GitHub step outputs are the only channel back to the workflow that survives
// the step boundary; the log is for people.
async function reportWork(work,env=process.env,pipeline=null,usage=null){
  const outcome=workOutcome(work);
  console.log(`[orma-live-worker] work ${outcome} · ${workMessage(work,pipeline)}`);
  if(!env.GITHUB_OUTPUT) return null;
  // Random delimiter per GitHub's own guidance: a provider error is arbitrary
  // text, and a fixed delimiter appearing inside it would let the value break
  // out of the output file.
  const delimiter=`ORMA_WORK_${randomUUID().replace(/-/g,'')}`;
  const lines=[
    `work_outcome=${outcome}`,
    `work_attempted=${work.attempted}`,
    `work_succeeded=${work.succeeded}`,
    `work_failed=${work.failed}`,
    `work_provider_parked=${work.providerParked}`,
    // Documents read and written this pass, so the health receipt can say what
    // a pass costs against the daily Firestore quota.
    `work_reads=${usage?Number(usage.reads||0):''}`,
    `work_writes=${usage?Number(usage.writes||0):''}`,
    `work_message<<${delimiter}\n${workMessage(work,pipeline)}\n${delimiter}`,
  ];
  await fs.appendFile(env.GITHUB_OUTPUT,`${lines.join('\n')}\n`);
  return outcome;
}

// One pass's options, read from the workflow environment. The drain
// (cli/drain-verification-queue.js) runs the same pass in a loop and must not
// drift from the scheduled worker, so both read them here.
function workerOptions(env=process.env,{workerId}={}){
  const specialistCandidateId=String(env.ORMA_SPECIALIST_CANDIDATE_ID||'').trim()||null;
  const specialistLimit=positiveInteger(env.ORMA_SPECIALIST_LIMIT,10);
  const workflowRunUrl=env.GITHUB_RUN_ID&&env.GITHUB_REPOSITORY
    ?`${env.GITHUB_SERVER_URL||'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`:null;
  return { workerId:workerId||`github-${env.GITHUB_RUN_ID || 'manual'}-${env.GITHUB_RUN_ATTEMPT || '1'}`,runId:env.GITHUB_RUN_ID||null,
    workflowRunUrl,campaignTrigger:'worker-catch-up',campaignEnabled:env.ORMA_CAMPAIGN_AUTOMATION_ENABLED==='true',
    campaignLimit:positiveInteger(env.ORMA_CAMPAIGN_LIMIT,10),campaignCapacity:positiveInteger(env.ORMA_CAMPAIGN_CAPACITY,15),
    campaignQueueCapacity:positiveInteger(env.ORMA_CAMPAIGN_QUEUE_CAPACITY,40),
    // A gate standing on findings only an agent can supply is dispatched to
    // that agent without waiting for a moderator who cannot supply them.
    // Bounded because each dispatch costs a model call on a metered account.
    gateDispatchEnabled:env.ORMA_GATE_DISPATCH_ENABLED!=='false',
    gateDispatchLimit:positiveInteger(env.ORMA_GATE_DISPATCH_LIMIT,3),
    // What is left at a gate after the dispatch gets a cited recommendation
    // beside each blocker. Smaller budget than the dispatch: an adjudication is
    // a web-search call, and it recommends rather than moving anything.
    gateAdjudicationEnabled:env.ORMA_GATE_ADJUDICATION_ENABLED!=='false',
    gateAdjudicationLimit:positiveInteger(env.ORMA_GATE_ADJUDICATION_LIMIT,2),
    // The batch is asked concurrently; this bounds how many model calls are in
    // flight at once. Separate from specialistLimit, which bounds the batch.
    specialistConcurrency:positiveInteger(env.ORMA_SPECIALIST_CONCURRENCY,4),
    limit:5,specialistLimit,specialistCandidateId };
}

async function main(){
  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  const store=new FirestoreBackofficeStore();
  const result = await runLiveBackofficeWorker(store, workerOptions(process.env));
  const work = summariseWorkAttempted(result);
  const usage=store.usage?store.usage.snapshot():null;
  console.log(JSON.stringify({ ...result, usage, work: { ...work, outcome:workOutcome(work), message:workMessage(work,result.pipeline) } }, null, 2));
  // Handed to the workflow rather than signalled by the exit code: a run where
  // every job was refused still completed every step it was asked to run, and
  // failing it here would hide the publication lanes behind a red X that has
  // nothing to do with them.
  await reportWork(work,process.env,result.pipeline,usage);
  if(blockedLanes(result).length) process.exitCode = 1;
}

if(require.main === module) main().catch(error => { console.error(`[orma-live-worker] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { main,positiveInteger,blockedLanes,reportWork,workerOptions,REVIEW_LANES };
