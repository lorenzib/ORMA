#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { planVerifiedTrailEditorial } = require('../workflows/plan-verified-trail-editorial');

async function readJson(file){ return JSON.parse(await fs.readFile(file, 'utf8')); }

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'verified-trail-editorial-queue.json')));
  const [registry, tre, cinque, braies, media] = await Promise.all([
    readJson(path.join(root, 'backoffice-data', 'orma-verified-registry.json')),
    readJson(path.join(root, 'backoffice', 'dossiers', 'tre-cime.json')),
    readJson(path.join(root, 'backoffice', 'dossiers', 'cinque-torri.json')),
    readJson(path.join(root, 'backoffice', 'dossiers', 'lago-braies.json')),
    readJson(path.join(root, 'backoffice-data', 'media-licensing-packet-attempt-4.json')),
  ]);
  const queue = planVerifiedTrailEditorial(registry, [tre, cinque, braies], media);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
  console.log(`[verified-editorial] Verified trails: ${queue.summary.verifiedTrails}`);
  console.log(`[verified-editorial] Draft jobs queued: ${queue.jobs.length}`);
  console.log('[verified-editorial] Publication remains locked behind a separate human gate.');
  console.log('[verified-editorial] Review: http://127.0.0.1:4173/content-desk.html');
}

if(require.main === module){
  main().catch(error => { console.error(`[verified-editorial] ${error.message}`); process.exitCode = 1; });
}

module.exports = { main };
