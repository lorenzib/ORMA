#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { option } = require('./discover');
const { planCatalogueCampaign } = require('../workflows/plan-catalogue-campaign');

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'catalogue-campaign.json')));
  const statePath = path.join(root, 'backoffice-data', 'catalogue-campaign-state.json');
  const identityPath = path.join(root, 'backoffice-data', 'route-source-identity.json');
  const jobLimit = Number(option(args, '--limit', '5'));
  if(!Number.isInteger(jobLimit) || jobLimit < 1 || jobLimit > 25){
    throw new Error('--limit must be an integer between 1 and 25');
  }
  let ledger = { queuedTrailIds: [], batches: [] };
  try { ledger = JSON.parse(await fs.readFile(statePath, 'utf8')); }
  catch(error){ if(error.code !== 'ENOENT') throw error; }
  let identity = { checks: {} };
  try { identity = JSON.parse(await fs.readFile(identityPath, 'utf8')); }
  catch(error){ if(error.code !== 'ENOENT') throw error; }
  const trails = loadProductionTrails(root);
  const campaign = planCatalogueCampaign(trails, {
    jobLimit, excludedTrailIds: ledger.queuedTrailIds, identityChecks: identity.checks || {},
  });
  ledger = {
    contractVersion: '1.0.0', updatedAt: campaign.generatedAt,
    queuedTrailIds: [...new Set([...ledger.queuedTrailIds, ...campaign.selectedTrailIds])],
    batches: [...ledger.batches, {
      queuedAt: campaign.generatedAt, trailIds: campaign.selectedTrailIds,
      jobIds: campaign.jobs.map(job => job.id),
    }],
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await Promise.all([
    fs.writeFile(outputPath, `${JSON.stringify(campaign, null, 2)}\n`, 'utf8'),
    fs.writeFile(statePath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8'),
  ]);
  console.log(`[campaign] Catalogue trails: ${campaign.summary.total}`);
  console.log(`[campaign] Curated/imported: ${campaign.summary.curated}/${campaign.summary.imported}`);
  console.log(`[campaign] Modern graduation verified: ${campaign.summary.modernGraduationVerified}`);
  console.log(`[campaign] Trail-number guidance verified/outstanding: ${campaign.summary.routeNumberGuidanceVerified}/${campaign.summary.routeNumberGuidanceOutstanding}`);
  console.log(`[campaign] Identity check available: ${campaign.summary.identityCheckQueued}`);
  console.log(`[campaign] Source identity contradicted: ${campaign.summary.sourceIdentityContradicted}`);
  console.log(`[campaign] Source identity required: ${campaign.summary.sourceIdentityRequired}`);
  console.log(`[campaign] Draft Cartographer jobs created: ${campaign.summary.jobsCreated}`);
  campaign.jobs.forEach(job => console.log(`[campaign] ${job.id} · ${job.candidateId} · ${job.action}`));
  console.log(`[campaign] Artifact: ${outputPath}`);
}

if(require.main === module){
  main().catch(error => {
    console.error(`[campaign] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
