#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const facts = require('../route-operational-facts.js');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'data', 'route-operational-facts.json');

let table;
try{
  table = JSON.parse(fs.readFileSync(file, 'utf8'));
}catch(error){
  console.error(`[error] data/route-operational-facts.json: ${error.message}`);
  process.exit(1);
}

const errors = facts.validateTable(table);
if(errors.length){
  console.error('[error] data/route-operational-facts.json');
  errors.forEach(message => console.error(`  - ${message}`));
  process.exit(1);
}

const rows = Array.isArray(table.facts) ? table.facts : [];
const verified = rows.filter(fact => fact.verified_at);
const byType = {};
for(const fact of rows) byType[fact.entity_type] = (byType[fact.entity_type] || 0) + 1;

const summary = Object.entries(byType)
  .map(([type, count]) => `${count} ${type}`)
  .join(', ');

console.log(
  `[ok] ${rows.length} operational fact(s)` +
  `${summary ? ` (${summary})` : ''}; ${verified.length} carry a verification date.`
);

if(rows.length === 0){
  console.log('     The table is empty by design. Every route shows "Not yet verified".');
}
