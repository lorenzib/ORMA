#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { runCatalogueBatch } = require('../workflows/run-catalogue-batch');
const { campaignItem, jobForItem } = require('../workflows/plan-catalogue-campaign');

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const campaignPath = path.resolve(option(args, '--campaign', path.join(root, 'backoffice-data', 'catalogue-campaign.json')));
  const reportPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'campaign-execution.json')));
  const identityPath = path.join(root, 'backoffice-data', 'route-source-identity.json');
  const candidateId = option(args, '--candidate', '');
  const trails = loadProductionTrails(root);
  // `--candidate` re-checks one trail's route source without disturbing the
  // planned batch. An operator needs this after correcting a wrong relation,
  // to retire the verdict that the correction answers.
  let campaign;
  if(candidateId){
    const trail = trails.find(entry => entry.id === candidateId);
    if(!trail) throw new Error(`Production trail not found: ${candidateId}`);
    const at = new Date().toISOString();
    campaign = { generatedAt: at, jobs: [jobForItem(campaignItem(trail), 0, at)] };
  }else{
    campaign = JSON.parse(await fs.readFile(campaignPath, 'utf8'));
  }
  const execution = await runCatalogueBatch(campaign, trails);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  for(const output of execution.outputs){
    const outputPath = path.join(root, output.outputRef);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(output.result, null, 2)}\n`, 'utf8');
  }
  // Keep what each reconstruction found so the next campaign plan can stop
  // queueing an identity check that has already been answered.
  let identity = { contractVersion: '1.0.0', updatedAt: null, checks: {} };
  try { identity = JSON.parse(await fs.readFile(identityPath, 'utf8')); }
  catch(error){ if(error.code !== 'ENOENT') throw error; }
  identity.checks = { ...(identity.checks || {}), ...execution.identityChecks };
  identity.updatedAt = execution.executedAt;
  await fs.writeFile(identityPath, `${JSON.stringify(identity, null, 2)}\n`, 'utf8');

  const report = { ...execution, outputs: execution.outputs.map(output => output.outputRef) };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[campaign-runner] Attempted: ${report.summary.attempted}`);
  console.log(`[campaign-runner] Needs human review: ${report.summary.needsHuman}`);
  console.log(`[campaign-runner] Source identity contradicted: ${report.summary.blocked}`);
  console.log(`[campaign-runner] Failed: ${report.summary.failed}`);
  report.jobs.forEach(job => console.log(`[campaign-runner] ${job.candidateId} · ${job.status} · ${job.outcome || job.error}`));
  console.log(`[campaign-runner] Report: ${reportPath}`);
}

if(require.main === module){
  main().catch(error => {
    console.error(`[campaign-runner] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
