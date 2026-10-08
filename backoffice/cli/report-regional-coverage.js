#!/usr/bin/env node
'use strict';

/**
 * report-regional-coverage — how much of each valley ORMA actually covers.
 *
 *   npm run backoffice:regional-coverage
 *   npm run backoffice:regional-coverage -- --json
 *
 * Read-only, and reads nothing from Firestore: the catalogue, the valley
 * taxonomy and the per-valley evidence files are all in the repository.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { summariseRegionalCoverage } = require('../workflows/regional-coverage');

// regions-config.js is a browser IIFE that assigns to window; the locality
// table lives only there on purpose, so that the site and the import pipeline
// cannot disagree about which valley a place is in.
function loadRegions(root){
  const context = { window:{}, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'regions-config.js'), 'utf8'), context,
    { filename:'regions-config.js' });
  return context.window.DoloPawsRegions;
}

function readJson(file){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function loadValleyResearch(root){
  const dir = path.join(root, 'backoffice-data/valley-research');
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.json'))
    .map(name => readJson(path.join(dir, name))).filter(Boolean);
}

function render(coverage){
  const t = coverage.totals;
  console.log(`[coverage] ${coverage.programme} · as of ${coverage.generatedAt}`);
  console.log(`[coverage] ${t.valleys} valleys · ${t.published} trails published · ${t.verified} ORMA Verified · ${t.candidatesAwaitingSelection} candidate(s) awaiting your selection`);
  console.log(`[coverage] covered ${t.covered} · started ${t.started} · not started ${t.unstarted} · thin (under ${coverage.policy.thinBelowPublished} trails) ${t.thin}`);
  console.log('[coverage] "covered" means at least half of what we publish there is Verified. Both thresholds are in DEFAULT_POLICY and are yours to change.');
  console.log('');
  console.log('[coverage] valley                            pub  ver   share  cands  state         cheapest evidence');
  for(const row of coverage.valleys){
    const closable = row.closableValleyWide.length
      ? `valley-wide: ${row.closableValleyWide.join(', ')}`
      : (row.researchFile ? 'per trail only' : 'NO RESEARCH FILE');
    console.log(`[coverage]   ${row.valley.padEnd(34)}${String(row.published).padStart(3)}  ${String(row.verified).padStart(3)}  ${String(Math.round(row.verifiedShare * 100) + '%').padStart(5)}  ${String(row.candidates).padStart(5)}  ${row.state.padEnd(13)} ${closable}`);
  }
  console.log('');
  const g = coverage.gaps;
  if(g.valleysWithoutResearchFile.length){
    console.log(`[coverage] ${g.valleysWithoutResearchFile.length} valley(s) have no evidence file, so nothing can say what they still need:`);
    console.log(`[coverage]   ${g.valleysWithoutResearchFile.join(' · ')}`);
  }
  if(g.unplacedTrails){
    // A trail with no valley is in no coverage figure at all.
    console.log(`[coverage] ${g.unplacedTrails} trail(s) carry no valley and are therefore in no figure above${g.unplacedVerifiedTrails.length ? `, including Verified: ${g.unplacedVerifiedTrails.join(', ')}` : ''}.`);
  }
  console.log('[coverage] Nothing was changed.');
}

function main(options = {}){
  const root = options.root || path.resolve(__dirname, '../..');
  const regions = loadRegions(root);
  const scouting = readJson(path.join(root, 'backoffice-data/new-trail-scouting.json'));
  const coverage = summariseRegionalCoverage({
    trails: options.trails || loadProductionTrails(root),
    valleyResearch: loadValleyResearch(root),
    scoutingCandidates: (scouting && scouting.candidates) || [],
    nearestLocality: regions && regions.nearestLocality,
    at: options.at,
  });
  if(process.argv.includes('--json')){ console.log(JSON.stringify(coverage, null, 2)); return coverage; }
  render(coverage);
  return coverage;
}

if(require.main === module){
  try { main(); } catch(error){ console.error(`[coverage] ${error.stack || error.message}`); process.exitCode = 1; }
}

module.exports = { main, render, loadRegions, loadValleyResearch };
