'use strict';

/**
 * How much of today's free Firestore allowance has actually been spent.
 *
 * The board said "about 30 passes left in today's free allowance". It was
 * computing `50,000 / cost-per-pass` and subtracting nothing, so it read "30
 * left" whether nothing had run or forty passes had. On the one question that
 * number exists to answer — can I run a drain today? — it was misleading, and
 * it was asked exactly that question the day it shipped.
 *
 * A pass knows what it spent. Accumulating that across the day is the only way
 * to know what is left, so the total is kept in one document and each pass adds
 * to it.
 *
 * Two things this is careful about:
 *
 *   The day boundary is **midnight US-Pacific**, which is when Firestore resets
 *   the free quota — not UTC and not Rome. A date formatted in that zone moves
 *   with daylight saving on its own, where a fixed offset would be an hour
 *   wrong for half the year.
 *
 *   It counts what goes through this store: the worker, the drain, the hazard
 *   watch, the reports. It does **not** see the desk, which reads Firestore
 *   straight from the browser. So it is a floor, never a total, and it has to
 *   be read as "at least this much" wherever it is shown.
 */

const DAILY_FREE_READS=50_000;
const DAILY_FREE_WRITES=20_000;
const ARTIFACT_ID='firestore-usage-day';

/** The quota day an instant falls in, by Firestore's own reset boundary. */
function quotaDay(at=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles'}).format(new Date(at));
}

/**
 * Yesterday's total is not today's. A stored day that is not the current one is
 * replaced rather than added to, which is what makes the reset automatic.
 */
function accumulateUsage(previous,spent={},at=Date.now()){
  const day=quotaDay(at);
  const carry=previous&&previous.day===day?previous:null;
  return {
    contractVersion:'1.0.0',
    day,
    reads:(carry?.reads||0)+Math.max(0,Number(spent.reads)||0),
    writes:(carry?.writes||0)+Math.max(0,Number(spent.writes)||0),
    passes:(carry?.passes||0)+1,
    // Kept so a reader can see the window this total covers, rather than
    // assuming it starts at the reset.
    firstSeenAt:carry?.firstSeenAt||new Date(at).toISOString(),
    updatedAt:new Date(at).toISOString(),
  };
}

/**
 * What the board shows. `atLeast` is in the name because the desk's own reads
 * are not counted and never will be from here.
 */
function describeDayUsage(usage,costPerPass){
  if(!usage||!usage.day)return null;
  const reads=Number(usage.reads)||0;
  const remaining=Math.max(0,DAILY_FREE_READS-reads);
  const perPass=Number(costPerPass)||0;
  return {
    day:usage.day,
    readsSoFar:reads,
    writesSoFar:Number(usage.writes)||0,
    passesSoFar:Number(usage.passes)||0,
    dailyFreeReads:DAILY_FREE_READS,
    sharePercent:Math.round((reads/DAILY_FREE_READS)*100),
    remainingReads:remaining,
    // Only meaningful once a pass has reported what it costs.
    passesLeft:perPass?Math.floor(remaining/perPass):null,
    sentence:`At least ${reads.toLocaleString('en-GB')} of ${DAILY_FREE_READS.toLocaleString('en-GB')} `
      +`free lookups used today (${Math.round((reads/DAILY_FREE_READS)*100)}%), over ${usage.passes||0} `
      +`automated run${Number(usage.passes)===1?'':'s'}`
      +`${perPass?`, leaving room for about ${Math.floor(remaining/perPass)} more this size`:''}. `
      +'The desk reads Firestore directly and is not counted here.',
  };
}

module.exports={DAILY_FREE_READS,DAILY_FREE_WRITES,ARTIFACT_ID,
  quotaDay,accumulateUsage,describeDayUsage};
