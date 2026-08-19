#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { planContentOperations } = require('../workflows/plan-content-operations');

function hasFlag(args, flag){ return args.includes(flag); }

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(option(args, '--output', path.join(root, 'backoffice-data', 'content-operations.json')));
  const plan = planContentOperations({
    asOf: option(args, '--as-of', new Date().toISOString()),
    socialEnabled: hasFlag(args, '--enable-social'),
  });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(`[content-ops] Cycle: ${plan.cycleDate}`);
  plan.workstreams.forEach(stream => console.log(
    `[content-ops] ${stream.label}: ${stream.status} · ${stream.cadence}${stream.nextRunOn ? ` · next ${stream.nextRunOn}` : ''}`
  ));
  console.log(`[content-ops] Queued draft jobs: ${plan.summary.jobs}`);
  console.log('[content-ops] Nothing is published automatically.');
  console.log(`[content-ops] Artifact: ${outputPath}`);
}

if(require.main === module){
  main().catch(error => { console.error(`[content-ops] ${error.message}`); process.exitCode = 1; });
}

module.exports = { main };
