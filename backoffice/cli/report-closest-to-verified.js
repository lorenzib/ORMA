#!/usr/bin/env node
'use strict';

/**
 * report-closest-to-verified -- which trail is nearest the seal, and why not yet.
 *
 *   npm run backoffice:closest
 *   npm run backoffice:closest -- --limit 25
 *
 * One artifact read. No model call, nothing written.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { closestToVerified, STAGES } = require('../workflows/closest-to-verified');

function parseArgs(argv){
  let limit = 15;
  for(let i = 0; i < argv.length; i += 1){
    const arg = String(argv[i]);
    if(arg === '--limit') limit = Number.parseInt(argv[i += 1], 10) || 15;
    if(arg.startsWith('--limit=')) limit = Number.parseInt(arg.slice('--limit='.length), 10) || 15;
  }
  return { limit };
}

function waiting(row){
  if(row.blockers.line.length) return `the line: ${row.blockers.line.join(', ')}`;
  if(row.blockers.directions.length) return `directions: ${row.blockers.directions.map(id => id.replace('logistics/', '')).join(', ')}`;
  // Out of the directions that needed researching, not out of four.
  //
  // The ledger only ever holds a claim an agent could not answer first time,
  // so a trail whose directions were answered straight off has no entry for
  // them at all. Against a hardcoded four that printed "directions 1/4
  // settled" for a trail with nothing missing, and three months of reading
  // this report said the pipeline was further from the end than it was.
  const { settled, known, exhausted, researching } = row.directions;
  if(known) return `${settled}/${known} researched direction(s) answered`
    + (exhausted ? `, ${exhausted} gave up` : '')
    + (researching ? `, ${researching} still looking` : '')
    + ` · ${row.blockers.waivable} optional detail open`;
  return row.blockers.waivable ? `${row.blockers.waivable} optional detail open` : 'nothing standing — waiting on its next pass';
}

async function main(options = {}){
  const { limit } = parseArgs(options.argv || process.argv.slice(2));
  const store = options.store || new FirestoreBackofficeStore();
  const orchestration = await store.getArtifact('trail-orchestration');
  if(!orchestration){ console.log('[closest] No orchestration artifact.'); return null; }
  const report = closestToVerified(orchestration, { limit });

  console.log(`[closest] ${report.total} trail(s) in the pipeline · ${report.moving} on the way · ${report.parked} parked.`);
  console.log('[closest] A trail is stopped by two things only: its line, and its directions. Everything else');
  console.log('[closest] is waivable and is recorded unknown once research runs out.');
  console.log('');
  console.log('[closest] How far along:');
  for(const stage of report.stages){
    if(!stage.trails) continue;
    console.log(`[closest]   ${String(stage.index + 1).padStart(2)}/${STAGES.length}  ${stage.state.padEnd(20)} ${stage.trails}`);
  }
  console.log('');
  console.log(`[closest] Nearest the seal (${report.nearest.length}):`);
  for(const row of report.nearest){
    console.log(`[closest]   ${String(row.stage + 1).padStart(2)}/${STAGES.length}  ${row.name}`);
    console.log(`[closest]         ${waiting(row)}`);
  }
  if(report.parkedBy.length){
    console.log('');
    console.log('[closest] Parked, not on the way anywhere until something sends them back:');
    for(const row of report.parkedBy) console.log(`[closest]   ${row.trails}x ${row.state}`);
  }
  console.log('[closest] Nothing was changed.');
  return report;
}

if(require.main === module) main().catch(error => { console.error(`[closest] ${error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, waiting, main };
