#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { runCartographer } = require('../workflows/run-cartographer');

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const queuePath = path.resolve(option(args, '--queue', path.join(root, 'backoffice-data', 'logistics-review.json')));
  const candidateId = option(args, '--candidate', 'osm-relation-1484751');
  const dossierPath = path.resolve(option(args, '--dossier', path.join(root, 'backoffice', 'dossiers', 'tre-cime.json')));
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'cartographer-review.json')));
  const [queue, dossier] = await Promise.all([
    fs.readFile(queuePath, 'utf8').then(JSON.parse),
    fs.readFile(dossierPath, 'utf8').then(JSON.parse),
  ]);
  const candidate = (queue.candidates || []).find(item => item.id === candidateId);
  if(!candidate) throw new Error(`Candidate not found: ${candidateId}`);
  if(dossier.candidateId !== candidateId) throw new Error('Dossier does not match candidate');
  const result = await runCartographer(candidate, dossier);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[cartographer] Relation version: ${result.source.relationVersion || 'unknown'}`);
  console.log(`[cartographer] Full geometry: ${result.geometry.coordinates.length} points`);
  console.log(`[cartographer] Components: ${result.components.length}`);
  console.log(`[cartographer] Review state: ${result.reviewState}`);
  console.log(`[cartographer] Review artifact: ${outputPath}`);
}

if(require.main === module){
  main().catch(error => {
    console.error(`[cartographer] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
