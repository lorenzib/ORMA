#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadProductionTrails, DEFAULT_FILES } = require('./load-production-trails');
const { buildCanonicalCatalog, ADAPTER_VERSION } = require('./trail-adapter');

const root = path.resolve(__dirname, '..');
const reportFlag = process.argv.indexOf('--report');
const reportTarget = reportFlag >= 0 ? process.argv[reportFlag + 1] : null;

let trails;
try{
  trails = loadProductionTrails(root);
}catch(error){
  console.error(`[error] production trail sources: ${error.message}`);
  process.exit(1);
}

const catalog = buildCanonicalCatalog(trails);
const published = catalog.records.filter(record => record.lifecycle === 'published');
const drafts = catalog.records.filter(record => record.lifecycle === 'draft');
const byOrigin = Object.fromEntries(['curated', 'osm'].map(origin => [
  origin,
  {
    total: catalog.records.filter(record => record.origin === origin).length,
    published: published.filter(record => record.origin === origin).length,
    draft: drafts.filter(record => record.origin === origin).length,
  },
]));
const report = {
  schemaVersion: '1.0.0',
  adapterVersion: ADAPTER_VERSION,
  sources: DEFAULT_FILES,
  totals: {
    sourceRecords: trails.length,
    canonicalRecords: catalog.records.length,
    published: published.length,
    draft: drafts.length,
    errors: catalog.errors.length,
  },
  byOrigin,
  excludedFromGeneration: catalog.excluded,
  errors: catalog.errors,
};

if(reportTarget){
  const absolute = path.resolve(root, reportTarget);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(root, absolute)}.`);
}

if(catalog.errors.length){
  console.error(`[error] ${catalog.errors.length} canonical production validation failure(s):`);
  catalog.errors.forEach(error => console.error(`  - ${error}`));
  process.exitCode = 1;
}else{
  console.log(
    `[ok] ${catalog.records.length} production trails adapted and schema-valid `
    + `(${published.length} published, ${drafts.length} held as drafts).`
  );
}

if(catalog.excluded.length){
  console.warn(`[hold] ${catalog.excluded.length} trail(s) are excluded from generated pages:`);
  catalog.excluded.forEach(entry =>
    console.warn(`  - ${entry.id}: ${entry.reasons.join('; ')}`));
}
