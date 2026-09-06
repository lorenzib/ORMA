#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { materializeApprovedPublications } = require('../workflows/materialize-approved-publications');
const { publicationRequestIsRetryable } = require('../workflows/publication-failure-receipts');

async function main(){
  const root = path.resolve(__dirname,'../..'); const store = new FirestoreBackofficeStore();
  const [requests,staging] = await Promise.all([store.getArtifact('publication-requests'),store.getArtifact('publication-staging')]);
  const at=new Date().toISOString();const forceRetry=process.env.ORMA_PUBLICATION_FORCE_RETRY==='true';
  const target = path.join(root,'data','verified-trail-overrides.json');
  const overrides = JSON.parse(await fs.readFile(target,'utf8'));
  const factsTarget = path.join(root,'data','route-operational-facts.json');
  const operationalFacts = JSON.parse(await fs.readFile(factsTarget,'utf8'));
  const approved = (requests?.requests || []).filter(request=>publicationRequestIsRetryable(request,{at,force:forceRetry}));
  const routesByCandidate = {};
  for(const request of approved){
    routesByCandidate[request.candidateId] = await store.getArtifact(`route-proposal-${request.candidateId}`);
  }
  const result = materializeApprovedPublications({
    requests, staging, routesByCandidate, overrides, operationalFacts, at, forceRetry,
  });
  if(!result.materialized){
    console.log('[orma-publication] No new approved publication requests.');
    return;
  }
  await fs.writeFile(target,`${JSON.stringify(result.overrides,null,2)}\n`,'utf8');
  if(result.operationalFactsChanged){
    await fs.writeFile(factsTarget,`${JSON.stringify(result.operationalFacts,null,2)}\n`,'utf8');
  }
  console.log(
    `[orma-publication] Materialized ${result.materialized} approved publication request(s)` +
    `${result.operationalFactsChanged ? `, including ${result.operationalFactsChanged} operational fact(s)` : ''}.`);
}

if(require.main === module) main().catch(error => { console.error(`[orma-publication] ${error.stack || error.message}`); process.exitCode=1; });

module.exports = { main };
