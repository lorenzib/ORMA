#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { auditImageCoverage } = require('../workflows/audit-image-coverage');

async function main(){
  const root = path.resolve(__dirname, '..', '..');
  const audit = await auditImageCoverage(root);
  const output = path.join(root, 'backoffice-data', 'image-coverage.json');
  await fs.writeFile(output, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  console.log(`[image-coverage] ${audit.summary.pagesScanned} guides scanned; ${audit.summary.missing} need imagery.`);
  console.log(`[image-coverage] ORMA library: ${audit.library.ormaAssetsScanned} images. Personal library connected: ${audit.library.personalLibraryConnected ? 'yes' : 'no'}.`);
  console.log('[image-coverage] Nothing was added to the public website.');
  console.log(`[image-coverage] Artifact: ${output}`);
}

if(require.main === module) main().catch(error => { console.error(`[image-coverage] ${error.message}`); process.exitCode = 1; });

module.exports = { main };
