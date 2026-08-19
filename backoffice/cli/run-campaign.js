#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { runCatalogueBatch } = require('../workflows/run-catalogue-batch');

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const campaignPath = path.resolve(option(args, '--campaign', path.join(root, 'backoffice-data', 'catalogue-campaign.json')));
  const reportPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'campaign-execution.json')));
  const campaign = JSON.parse(await fs.readFile(campaignPath, 'utf8'));
  const execution = await runCatalogueBatch(campaign, loadProductionTrails(root));
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  for(const output of execution.outputs){
    const outputPath = path.join(root, output.outputRef);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(output.result, null, 2)}\n`, 'utf8');
  }
  const report = { ...execution, outputs: execution.outputs.map(output => output.outputRef) };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[campaign-runner] Attempted: ${report.summary.attempted}`);
  console.log(`[campaign-runner] Needs human review: ${report.summary.needsHuman}`);
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
