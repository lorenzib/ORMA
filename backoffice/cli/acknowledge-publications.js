#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { publicationRequestCanRetry } = require('../workflows/publication-failure-receipts');

async function main(){
  const root = path.resolve(__dirname, '../..');
  const overrides = JSON.parse(await fs.readFile(path.join(root, 'data', 'verified-trail-overrides.json'), 'utf8'));
  const approvalIds = new Set((overrides.trails || []).map(entry => entry.approvalId).filter(Boolean));
  const store = new FirestoreBackofficeStore();
  const artifact = await store.getArtifact('publication-requests');
  if(!artifact) throw new Error('Publication request artifact is missing');
  const pullRequestUrl = process.env.ORMA_PUBLICATION_PR_URL || null;
  let acknowledged = 0;
  const requests = (artifact.requests || []).map(request => {
    if(!publicationRequestCanRetry(request) || !approvalIds.has(request.id)) return request;
    acknowledged += 1;
    return { ...request, status:'pull-request-opened', retryable:false, pullRequestUrl, acknowledgedAt:new Date().toISOString() };
  });
  if(acknowledged){
    await store.setArtifact('publication-requests', { ...artifact, updatedAt:new Date().toISOString(), requests });
  }
  console.log(`[orma-publication] Acknowledged ${acknowledged} publication request(s).`);
}

if(require.main === module) main().catch(error => {
  console.error(`[orma-publication] ${error.stack || error.message}`);
  process.exitCode = 1;
});

module.exports = { main };
