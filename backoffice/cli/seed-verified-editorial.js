#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { compileVerifiedEditorialPreview } = require('../workflows/compile-verified-editorial-preview');

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const queue = JSON.parse(await fs.readFile(path.join(root, 'backoffice-data', 'verified-trail-editorial-queue.json'), 'utf8'));
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'verified-trail-editorial-execution.json')));
  const execution = compileVerifiedEditorialPreview(queue);
  await fs.writeFile(outputPath, `${JSON.stringify(execution, null, 2)}\n`, 'utf8');
  console.log(`[verified-editorial-preview] Trails: ${execution.summary.trails}`);
  console.log(`[verified-editorial-preview] Items ready for review: ${execution.summary.readyForReview}`);
  console.log('[verified-editorial-preview] Codex-assisted preview only; publication remains locked.');
  console.log('[verified-editorial-preview] Review: http://127.0.0.1:4173/content-desk.html');
}

if(require.main === module){
  main().catch(error => { console.error(`[verified-editorial-preview] ${error.message}`); process.exitCode = 1; });
}

module.exports = { main };
