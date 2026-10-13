#!/usr/bin/env node
'use strict';

/**
 * show-trail-progress -- why one trail is not moving.
 *
 *   npm run backoffice:trail-progress -- --trail osm-19153189
 *
 * Read-only: the orchestration artifact and that trail's own jobs. No model
 * call, nothing written.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { trailProgress } = require('../workflows/trail-progress-read');
const { findTrail } = require('../workflows/geometry-audit-read');

function parseArgs(argv){
  let trail = null;
  for(let i = 0; i < argv.length; i += 1){
    const arg = String(argv[i]);
    if(arg === '--trail'){ trail = argv[i += 1]; continue; }
    if(arg.startsWith('--trail=')) trail = arg.slice('--trail='.length);
  }
  return { trail: trail || null };
}

async function main(options = {}){
  const { trail: trailId } = parseArgs(options.argv || process.argv.slice(2));
  if(!trailId) throw new Error('--trail <id> is required.');
  const store = options.store || new FirestoreBackofficeStore();

  const orchestration = await store.getArtifact('trail-orchestration');
  const trail = findTrail(orchestration, trailId);
  if(!trail){ console.log(`[progress] No orchestrated trail for "${trailId}".`); return null; }

  const jobs = typeof store.getJobsByIds === 'function'
    ? await store.getJobsByIds(trail.jobIds || [])
    : [];
  const progress = trailProgress(trail, jobs);

  console.log(`[progress] ${progress.trailId} · ${progress.state} · ${progress.blockers} blocker(s) · ${jobs.length} job(s) on record`);
  console.log('[progress] The three agents advancement waits on:');
  for(const entry of progress.base){
    console.log(`[progress]   ${entry.agentId.padEnd(18)} ${entry.status}`);
  }
  console.log(`[progress] claims: ${progress.claims.total} · ${progress.claims.supported} supported · `
    + `${progress.claims.researchable} still researchable · ${progress.claims.exhausted} exhausted`);
  console.log(`[progress] queued jobs: ${progress.queued}`);
  if(progress.blockedBy.length){
    console.log('');
    console.log(`[progress] HELD: ${progress.blockedBy.join(', ')} ${progress.blockedBy.length === 1 ? 'has' : 'have'} no completed job.`);
    console.log('[progress] Advancement past evidence-resolution needs one from each of the three, so');
    console.log('[progress] this trail stays where it is with nothing to report and nothing to do.');
  }
  console.log('[progress] Nothing was changed.');
  return progress;
}

if(require.main === module) main().catch(error => { console.error(`[progress] ${error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, main };
