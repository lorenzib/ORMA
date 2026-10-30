#!/usr/bin/env node
'use strict';

/**
 * Record walks verified by hand in the backoffice, then redraw the trail board.
 *
 * Run by the "ORMA hand verifications" workflow when a verification merges to
 * main, so the board shows it within minutes rather than at the next three-hourly
 * worker pass. The worker runs the same step first in every pass as well, so a
 * missed push is caught up. No model call; a handful of Firestore reads.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { recordHandVerifications, recordTrailBoard } = require('../workflows/run-live-backoffice-worker');

async function main(options = {}){
  const store = options.store || new FirestoreBackofficeStore();
  const at = options.at || new Date().toISOString();
  const result = await recordHandVerifications(store, { ...options, at });
  const board = await recordTrailBoard(store, { ...options, at });
  console.log(`[hand-verifications] recorded ${result?.recorded?.length || 0}, withdrawn ${result?.withdrawn?.length || 0}, queued jobs retired ${result?.retiredJobs?.length || 0}`);
  if(result?.recorded?.length) console.log(`[hand-verifications] recorded: ${result.recorded.join(', ')}`);
  if(result?.withdrawn?.length) console.log(`[hand-verifications] withdrawn: ${result.withdrawn.join(', ')}`);
  if(result?.compacted?.length) console.log(`[hand-verifications] dropped the copied source list from ${result.compacted.length} record(s)`);
  if(board?.error) console.error(`[hand-verifications] board not refreshed: ${board.error}`);
  else if(board) console.log(`[hand-verifications] board: ${board.verified} Verified on the site, ${board.verifiedByHand} by hand, ${board.stages?.passed} passed by the pipeline, ${board.disagree} disagree`);
  return { result, board };
}

if(require.main === module) main().catch(error => { console.error(`[hand-verifications] ${error.message}`); process.exitCode = 1; });

module.exports = { main };
