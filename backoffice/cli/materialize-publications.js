#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { materializeApprovedPublications } = require('../workflows/materialize-approved-publications');

async function main(){
  const root = path.resolve(__dirname,'../..'); const store = new FirestoreBackofficeStore();
  const [requests,staging] = await Promise.all([store.getArtifact('publication-requests'),store.getArtifact('publication-staging')]);
  const target = path.join(root,'data','verified-trail-overrides.json');
  const overrides = JSON.parse(await fs.readFile(target,'utf8'));
  const approved = (requests?.requests || []).filter(request => request.status === 'approved-for-pr-creation');
  const routesByCandidate = {};
  for(const request of approved){
    routesByCandidate[request.candidateId] = await store.getArtifact(`route-proposal-${request.candidateId}`);
  }
  const result = materializeApprovedPublications({
    requests, staging, routesByCandidate, overrides, at:new Date().toISOString(),
  });
  if(!result.materialized){
    console.log('[orma-publication] No new approved publication requests.');
    return;
  }
  await fs.writeFile(target,`${JSON.stringify(result.overrides,null,2)}\n`,'utf8');
  console.log(`[orma-publication] Materialized ${result.materialized} approved publication request(s).`);
}

if(require.main === module) main().catch(error => { console.error(`[orma-publication] ${error.stack || error.message}`); process.exitCode=1; });

module.exports = { main };
