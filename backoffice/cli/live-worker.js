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
const REVIEW_LANES = Object.freeze(['reviews', 'dossierReviews', 'publications']);

function blockedLanes(result = {}){
  return REVIEW_LANES.filter(lane => (result[lane] || []).some(item => item.status === 'blocked'))
    .concat((result.communityHazards?.vetted || [])
      .some(item => item.status === 'vetting-failed' && !providerOutage(item.error)) ? ['communityHazards'] : []);
}

// GitHub step outputs are the only channel back to the workflow that survives
// the step boundary; the log is for people.
async function reportWork(work,env=process.env){
  const outcome=workOutcome(work);
  console.log(`[orma-live-worker] work ${outcome} · ${workMessage(work)}`);
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
    `work_message<<${delimiter}\n${workMessage(work)}\n${delimiter}`,
  ];
  await fs.appendFile(env.GITHUB_OUTPUT,`${lines.join('\n')}\n`);
  return outcome;
}

async function main(){
  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  const workerId = `github-${process.env.GITHUB_RUN_ID || 'manual'}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`;
  const specialistCandidateId=String(process.env.ORMA_SPECIALIST_CANDIDATE_ID||'').trim()||null;
  const specialistLimit=positiveInteger(process.env.ORMA_SPECIALIST_LIMIT,10);
  const workflowRunUrl=process.env.GITHUB_RUN_ID&&process.env.GITHUB_REPOSITORY
    ?`${process.env.GITHUB_SERVER_URL||'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null;
  const result = await runLiveBackofficeWorker(new FirestoreBackofficeStore(), { workerId,runId:process.env.GITHUB_RUN_ID||null,
    workflowRunUrl,campaignTrigger:'worker-catch-up',campaignEnabled:process.env.ORMA_CAMPAIGN_AUTOMATION_ENABLED==='true',
    campaignLimit:positiveInteger(process.env.ORMA_CAMPAIGN_LIMIT,10),campaignCapacity:positiveInteger(process.env.ORMA_CAMPAIGN_CAPACITY,15),
    campaignQueueCapacity:positiveInteger(process.env.ORMA_CAMPAIGN_QUEUE_CAPACITY,40),
    limit:5,specialistLimit,specialistCandidateId });
  const work = summariseWorkAttempted(result);
  console.log(JSON.stringify({ ...result, work: { ...work, outcome:workOutcome(work), message:workMessage(work) } }, null, 2));
  // Handed to the workflow rather than signalled by the exit code: a run where
  // every job was refused still completed every step it was asked to run, and
  // failing it here would hide the publication lanes behind a red X that has
  // nothing to do with them.
  await reportWork(work);
  if(blockedLanes(result).length) process.exitCode = 1;
}

if(require.main === module) main().catch(error => { console.error(`[orma-live-worker] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { main,positiveInteger,blockedLanes,reportWork,REVIEW_LANES };
