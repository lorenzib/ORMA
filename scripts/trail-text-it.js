#!/usr/bin/env node
'use strict';

// A trail's own words in Italian: data/trail-text-it/<id>.js, one small file
// per trail, keyed by the English sentence. The trail page loads the file for
// Italian readers and i18n.js's trailText() swaps each sentence it finds. The
// trail record itself stays English, because search and the dog-match engine
// read its words.
//
// The English is the key on purpose. When a walk's description is reworded,
// its old Italian simply stops matching and the page shows the new English
// until someone translates it; nothing shows a stale translation.
//
//   node scripts/trail-text-it.js                 report what is untranslated
//   node scripts/trail-text-it.js --missing out.json
//                                                 write the untranslated sentences
//   node scripts/trail-text-it.js --apply dict.json
//                                                 add {English: Italian} pairs and
//                                                 rewrite every trail's file

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DETAIL_DIR = path.join(ROOT, 'data', 'trail-details');
const OUT_DIR = path.join(ROOT, 'data', 'trail-text-it');

// The trail fields a visitor reads. Sources, credits and the reviewers' route
// audit notes are evidence, not page text, and stay as written.
const FIELDS = [
  'desc', 'tips', 'surfaceHazards[]', 'terrainType', 'startPoint.label', 'imageAlt',
  'licensedPhotos[].alt', 'liftAccess.notes', 'shadeDescription',
  'routeNumberGuidance.start', 'routeNumberGuidance.sequence', 'routeNumberGuidance.switches',
  'routeNumberGuidance.status', 'routeNumberGuidance.steps[].text', 'decisionPoints[].instruction',
];

function loadTrails(){
  const context = { window:{}, console };
  vm.createContext(context);
  fs.readdirSync(DETAIL_DIR).filter(file => file.endsWith('.js')).sort().forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(DETAIL_DIR, file), 'utf8'), context, { filename:file });
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'trail-audits.js'), 'utf8'), context, { filename:'trail-audits.js' });
  const seen = new Set();
  const trails = (context.window.trails || []).filter(trail => trail && trail.id && !seen.has(trail.id) && seen.add(trail.id));
  context.window.DoloPawsTrailAudits.apply(trails);
  return trails;
}

function valuesAt(object, fieldPath){
  let current = [object];
  for(const part of fieldPath.split('.')){
    const many = part.endsWith('[]');
    const key = many ? part.slice(0, -2) : part;
    current = current.flatMap(value => (value && value[key] != null ? (many ? value[key] : [value[key]]) : []));
  }
  return current.filter(value => typeof value === 'string' && /[A-Za-z]/.test(value));
}

function sentencesOf(trail){
  return [...new Set(FIELDS.flatMap(field => valuesAt(trail, field)))];
}

function fileFor(id){
  return path.join(OUT_DIR, `${id}.js`);
}

function readTable(id){
  const file = fileFor(id);
  if(!fs.existsSync(file)) return {};
  const context = { window:{} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  return context.window.ORMA_TRAIL_TEXT_IT || {};
}

function writeTable(id, table){
  const body = Object.keys(table).map(english => `  ${JSON.stringify(english)}: ${JSON.stringify(table[english])}`).join(',\n');
  fs.writeFileSync(fileFor(id),
    `// ${id} in Italian, keyed by the English sentence. See scripts/trail-text-it.js.\n` +
    `window.ORMA_TRAIL_TEXT_IT = Object.assign(window.ORMA_TRAIL_TEXT_IT || {}, {\n${body}\n});\n`);
}

function audit(trails = loadTrails()){
  const missing = new Map();
  let total = 0;
  trails.forEach(trail => {
    const table = readTable(trail.id);
    sentencesOf(trail).forEach(sentence => {
      total += 1;
      if(!table[sentence]) missing.set(sentence, trail.id);
    });
  });
  return { trails, total, missing };
}

function apply(dictionary){
  fs.mkdirSync(OUT_DIR, { recursive:true });
  const trails = loadTrails();
  const live = new Set(trails.map(trail => trail.id));
  trails.forEach(trail => {
    const before = readTable(trail.id);
    const table = {};
    // Only sentences the trail still says: a reworded one drops its old Italian.
    sentencesOf(trail).forEach(sentence => {
      const italian = dictionary[sentence] || before[sentence];
      if(italian) table[sentence] = italian;
    });
    if(Object.keys(table).length) writeTable(trail.id, table);
  });
  // A trail that left the catalogue takes its Italian with it.
  fs.readdirSync(OUT_DIR).forEach(file => {
    if(file.endsWith('.js') && !live.has(file.slice(0, -3))) fs.unlinkSync(path.join(OUT_DIR, file));
  });
}

function main(argv){
  const applyAt = argv.indexOf('--apply');
  if(applyAt >= 0) apply(JSON.parse(fs.readFileSync(argv[applyAt + 1], 'utf8')));
  const result = audit();
  const missingAt = argv.indexOf('--missing');
  if(missingAt >= 0){
    const out = {};
    result.missing.forEach((id, sentence) => { out[sentence] = id; });
    fs.writeFileSync(argv[missingAt + 1], JSON.stringify(out, null, 1));
  }
  console.log(`[trail-text-it] ${result.total - result.missing.size} of ${result.total} trail sentences have Italian across ${result.trails.length} trails.`);
}

if(require.main === module) main(process.argv.slice(2));

module.exports = { FIELDS, loadTrails, sentencesOf, readTable, audit, apply };
