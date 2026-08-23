#!/usr/bin/env node
'use strict';

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { runLiveBackofficeWorker } = require('../workflows/run-live-backoffice-worker');

function positiveInteger(value,fallback){
  const parsed=Number.parseInt(value,10);
  return Number.isInteger(parsed)&&parsed>0?parsed:fallback;
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
    campaignLimit:positiveInteger(process.env.ORMA_CAMPAIGN_LIMIT,10),campaignCapacity:positiveInteger(process.env.ORMA_CAMPAIGN_CAPACITY,15),newsletterEnabled:process.env.ORMA_NEWSLETTER_ENABLED==='true',limit:5,specialistLimit,specialistCandidateId });
  console.log(JSON.stringify(result, null, 2));
  if(result.reviews.some(item => item.status === 'blocked')
    || result.dossierReviews.some(item => item.status === 'blocked')
    || result.editorialReviews.some(item => item.status === 'blocked')
    || result.imageReviews.some(item => item.status === 'blocked')
    || result.newsletterReviews.some(item => item.status === 'blocked')
    || result.analystReviews.some(item => item.status === 'blocked')
    || result.publications.some(item => item.status === 'blocked')) process.exitCode = 1;
}

if(require.main === module) main().catch(error => { console.error(`[orma-live-worker] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { main,positiveInteger };
