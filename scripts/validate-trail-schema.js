#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateTrailRecord } = require('./trail-schema');

const root = path.resolve(__dirname, '..');
const files = process.argv.slice(2);
const targets = files.length ? files : [
  'data/examples/trail.curated.example.json',
  'data/examples/trail.imported.example.json',
];

let failed = false;
for(const target of targets){
  const absolute = path.resolve(root, target);
  let record;
  try{
    record = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  }catch(error){
    console.error(`[error] ${target}: ${error.message}`);
    failed = true;
    continue;
  }
  const errors = validateTrailRecord(record);
  if(errors.length){
    failed = true;
    console.error(`[error] ${target}`);
    errors.forEach(error => console.error(`  - ${error}`));
  }else{
    console.log(`[ok] ${target} (${record.origin}, schema ${record.schemaVersion})`);
  }
}

if(failed) process.exitCode = 1;
