#!/usr/bin/env node
'use strict';

/**
 * report-resolution-yield -- which attempt actually answered the claim.
 *
 *   npm run backoffice:resolution-yield
 *
 * Reads one artifact, calls no model, writes nothing. The point is to set the
 * research ladder's length from what it yields instead of from an intuition
 * about it: for a waivable claim, the end of the ladder and the attempt that
 * would have been last reach the same place, because an unanswered waivable
 * claim is recorded unknown and the trail is approved regardless.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { resolutionYield } = require('../workflows/resolution-yield');

async function main(options = {}){
  const store = options.store || new FirestoreBackofficeStore();
  const orchestration = await store.getArtifact('trail-orchestration');
  if(!orchestration){ console.log('[yield] No orchestration artifact. Nothing to measure.'); return null; }
  const result = resolutionYield(orchestration, options);

  console.log(`[yield] ${result.claims} claim(s) across the catalogue · ${result.waivableClaims} waivable · ${result.routeGuidanceClaims} route guidance.`);
  console.log(`[yield] Of the waivable ones, ${result.resolved} were answered and ${result.exhausted} exhausted the ladder.`);
  console.log(`[yield] ${result.searchesSpentOnWaivable} search(es) spent on waivable claims in total.`);
  console.log('');
  console.log('[yield] Which attempt produced the answer:');
  if(!result.resolvedOnAttempt.length) console.log('[yield]   nothing resolved yet.');
  for(const row of result.resolvedOnAttempt){
    console.log(`[yield]   attempt ${row.attempt}: ${row.count} answer(s)`);
  }
  console.log('');
  console.log('[yield] If the ladder were cut for waivable claims only:');
  for(const row of result.savedAt){
    console.log(`[yield]   cut to ${row.cut}: ${row.answersLost} answer(s) lost, ${row.searchesSaved} search(es) saved`);
  }
  console.log('');
  console.log(`[yield] Route guidance, resolved in the same pool as the rest: ${JSON.stringify(result.guidanceStates)}`);
  // Per claim, because a trail needs all four and the aggregate cannot say
  // whether one rule is holding everything or all four are merely hard.
  console.log('[yield] Each of the four, and how often it is answered:');
  for(const claim of result.guidanceByClaim||[]){
    const share=claim.total?Math.round((claim.supported/claim.total)*100):0;
    console.log(`[yield]   ${String(claim.claimId).padEnd(22)} ${String(claim.supported).padStart(3)}/${String(claim.total).padEnd(3)} answered (${share}%)`
      +` · ${claim.sourceExhausted} exhausted · ${claim.contradicted} contradicted · ${claim.searches} search(es)`);
  }
  console.log(`[yield] ${(result.trailsWithAllFourDirections||[]).length} of ${result.trailsWithAnyDirection} trail(s) have all four settled`
    +`${(result.trailsWithAllFourDirections||[]).length?`: ${result.trailsWithAllFourDirections.join(', ')}`:''}`);
  console.log(`[yield] ${result.doomedTrails} trail(s) cannot be verified because their directions could not be established,`);
  console.log(`[yield] and ${result.wastedOnDoomed} search(es) went on optional detail for those trails before anyone knew.`);
  console.log('[yield] Route guidance keeps its full ladder either way. Nothing was changed.');
  return result;
}

if(require.main === module) main().catch(error => { console.error(`[yield] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { main };
