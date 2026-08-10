#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/alpine-plants.json'), 'utf8'));
const required = [
  'id','commonName','aliases','scientificName','family','safety','severity',
  'proximitySafe','ingestionRisk','summary','season','floweringMonths','habitats',
  'elevation','identification','lookalikes','dogSafety','symptoms',
  'actionIfIngested','interestingFact','image','evidence','confidence',
  'reviewStatus','lastReviewed',
];
const allowed = {
  safety:new Set(['safe','caution','dangerous']),
  severity:new Set(['low','moderate','high','critical']),
  season:new Set(['spring','summer','autumn','winter']),
  confidence:new Set(['high','medium','limited']),
  reviewStatus:new Set(['veterinary_review_required','approved']),
};
const errors = [];
const ids = new Set();

if(!data.meta || !Array.isArray(data.plants)) errors.push('Collection must contain meta and plants.');
if(!data.meta || data.meta.editorialStatus !== 'draft') errors.push('The imported guide must remain editorialStatus=draft until sign-off.');

for(const [index, plant] of (data.plants || []).entries()){
  const at = `plants[${index}]`;
  required.forEach(key => {
    if(!(key in plant)) errors.push(`${at}.${key} is required.`);
  });
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plant.id || '')) errors.push(`${at}.id is invalid.`);
  if(ids.has(plant.id)) errors.push(`${at}.id duplicates ${plant.id}.`);
  ids.add(plant.id);
  ['safety','severity','confidence','reviewStatus'].forEach(key => {
    if(!allowed[key].has(plant[key])) errors.push(`${at}.${key} is invalid.`);
  });
  if(!Array.isArray(plant.season) || !plant.season.length || plant.season.some(value => !allowed.season.has(value))){
    errors.push(`${at}.season is invalid.`);
  }
  ['identification','habitats','actionIfIngested','evidence'].forEach(key => {
    if(!Array.isArray(plant[key]) || !plant[key].length) errors.push(`${at}.${key} must not be empty.`);
  });
  for(const evidence of plant.evidence || []){
    try{
      const url = new URL(evidence.url);
      if(url.protocol !== 'https:') throw new Error('not HTTPS');
    }catch(error){ errors.push(`${at}.evidence contains an invalid HTTPS URL.`); }
  }
  for(const step of plant.actionIfIngested || []){
    if(/^\s*(?:induce vomiting|give (?:food|milk|charcoal|medication))/i.test(step)){
      errors.push(`${at}.actionIfIngested gives prohibited home-treatment advice.`);
    }
  }
  if(plant.image && plant.image.src && !plant.image.credit) errors.push(`${at}.image requires a credit.`);
}

if(errors.length){
  console.error(`Alpine plant validation failed (${errors.length}):`);
  errors.forEach(error => console.error(`  - ${error}`));
  process.exitCode = 1;
}else{
  const counts = Object.fromEntries(['safe','caution','dangerous'].map(safety => [
    safety, data.plants.filter(plant => plant.safety === safety).length,
  ]));
  console.log(`[ok] ${data.plants.length} alpine plant records validated (${counts.safe} safe, ${counts.caution} caution, ${counts.dangerous} dangerous). Editorial status remains draft.`);
}
