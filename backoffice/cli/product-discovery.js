#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { runProductDiscovery } = require('../workflows/run-product-discovery');

async function main(){
  const root = path.resolve(__dirname, '..', '..');
  const packet = await runProductDiscovery();
  const output = path.join(root, 'backoffice-data', 'product-ideas.json');
  await fs.writeFile(output, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  console.log(`[product-discovery] ${packet.summary.total} ideas prepared; ${packet.summary.highImpact} high impact.`);
  console.log('[product-discovery] Research only. Nothing was built or published.');
  console.log(`[product-discovery] Artifact: ${output}`);
}

if(require.main === module) main().catch(error => { console.error(`[product-discovery] ${error.message}`); process.exitCode = 1; });

module.exports = { main };
