#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { planContentFlow } = require('../workflows/plan-content-flow');

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'content-flow.json')));
  const limit = Number(option(args, '--limit', '10'));
  if(!Number.isInteger(limit) || limit < 1 || limit > 100){
    throw new Error('--limit must be an integer between 1 and 100');
  }
  const ids = option(args, '--trails', '').split(',').map(id => id.trim()).filter(Boolean);
  const flow = planContentFlow(loadProductionTrails(root), { limit, trailIds: ids });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(flow, null, 2)}\n`, 'utf8');
  console.log(`[content-flow] Trails: ${flow.summary.trails}`);
  console.log(`[content-flow] Editing jobs: ${flow.summary.editingJobs}`);
  console.log(`[content-flow] Picture gathering jobs: ${flow.summary.pictureJobs}`);
  console.log('[content-flow] Draft only; editorial and licensing approval are required.');
  console.log(`[content-flow] Artifact: ${outputPath}`);
}

if(require.main === module){
  main().catch(error => {
    console.error(`[content-flow] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
