#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { enrichQueue } = require('../workflows/add-logistics');

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const inputPath = path.resolve(option(args, '--input', path.join(root, 'backoffice-data', 'review-queue.json')));
  const accessPath = path.resolve(option(args, '--access-points', path.join(root, 'data', 'access-points.geojson')));
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'logistics-review.json')));
  const radiusM = Number(option(args, '--radius', '500'));
  if(!Number.isFinite(radiusM) || radiusM < 50 || radiusM > 2000){
    throw new Error('--radius must be between 50 and 2000 metres');
  }
  const [queue, accessPoints] = await Promise.all([
    fs.readFile(inputPath, 'utf8').then(JSON.parse),
    fs.readFile(accessPath, 'utf8').then(JSON.parse),
  ]);
  const result = enrichQueue(queue, accessPoints, { radiusM });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[backoffice] Processed ${result.logistics.candidatesProcessed} candidates`);
  console.log(`[backoffice] Parking suggestions ready: ${result.logistics.withParkingSuggestions}`);
  console.log(`[backoffice] Parking unresolved: ${result.logistics.unresolvedParking}`);
  console.log(`[backoffice] Logistics review: ${outputPath}`);
}

if(require.main === module){
  main().catch(error => {
    console.error(`[backoffice] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
