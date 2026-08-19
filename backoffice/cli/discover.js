#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { discoverTrails } = require('../workflows/discover-trails');

function option(args, name, fallback){
  const prefixed = `${name}=`;
  const inline = args.find(arg => arg.startsWith(prefixed));
  if(inline) return inline.slice(prefixed.length);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const inputPath = path.resolve(option(args, '--input', path.join(root, 'data', 'dolomites-trails.json')));
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'review-queue.json')));
  const limit = Number(option(args, '--limit', '10'));
  if(!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be an integer between 1 and 100');

  const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const result = discoverTrails(payload, { limit });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`[backoffice] Assessed ${result.summary.assessed} trails`);
  console.log(`[backoffice] Queued ${result.summary.queued} of ${result.summary.eligible} eligible loops`);
  console.log(`[backoffice] Rejected ${result.summary.rejected} candidates`);
  console.log(`[backoffice] Review queue: ${outputPath}`);
}

if(require.main === module){
  main().catch(error => {
    console.error(`[backoffice] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, option };
