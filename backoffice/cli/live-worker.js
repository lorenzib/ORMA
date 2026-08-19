#!/usr/bin/env node
'use strict';

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { runLiveBackofficeWorker } = require('../workflows/run-live-backoffice-worker');

async function main(){
  if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required');
  const workerId = `github-${process.env.GITHUB_RUN_ID || 'manual'}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`;
  const result = await runLiveBackofficeWorker(new FirestoreBackofficeStore(), { workerId, limit:5 });
  console.log(JSON.stringify(result, null, 2));
  if(result.reviews.some(item => item.status === 'blocked')
    || result.dossierReviews.some(item => item.status === 'blocked')
    || result.publications.some(item => item.status === 'blocked')) process.exitCode = 1;
}

if(require.main === module) main().catch(error => { console.error(`[orma-live-worker] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { main };
