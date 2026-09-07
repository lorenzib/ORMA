#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { buildPublicationStaging } = require('../workflows/build-publication-staging');

async function readJson(file, fallback = null){ try{ return JSON.parse(await fs.readFile(file, 'utf8')); } catch(error){ if(error.code === 'ENOENT') return fallback; throw error; } }

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'publication-staging.json')));
  const [queue, execution, reviews] = await Promise.all([
    readJson(path.join(root, 'backoffice-data', 'verified-trail-editorial-queue.json')),
    readJson(path.join(root, 'backoffice-data', 'verified-trail-editorial-execution.json')),
    readJson(path.join(root, 'backoffice-data', 'content-review-queue.json'), { submissions: [] }),
  ]);
  const staging = buildPublicationStaging(queue, execution, reviews,
    { productionTrails: loadProductionTrails(root) });
  await fs.writeFile(outputPath, `${JSON.stringify(staging, null, 2)}\n`, 'utf8');
  console.log(`[publication-staging] Ready for preview: ${staging.summary.readyForPreview}`);
  console.log(`[publication-staging] Waiting for approvals: ${staging.summary.waitingForApprovals}`);
  console.log('[publication-staging] Public mutations: 0');
}

if(require.main === module){ main().catch(error => { console.error(`[publication-staging] ${error.message}`); process.exitCode = 1; }); }

module.exports = { main };
