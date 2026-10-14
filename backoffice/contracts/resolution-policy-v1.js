'use strict';

const VERSION = '1.0.0';
const MAX_AUTOMATED_ATTEMPTS = 5;
// Optional detail stops at three.
//
// Route guidance decides whether a trail can be verified at all, so it keeps
// the full ladder. Everything else is background research that is recorded
// `unknown` whether it exhausts at three or at five, and the gate will not
// approve a trail while any of it is still researchable: Le Belvédère reached
// the dossier gate on 13 October carrying 110 blockers, not one of them
// unwaivable, and was sent back to look again for details that were going to
// be written down as unknown either way.
//
// Three is measured, not chosen. Across the catalogue the ladder answered 55
// claims on the first attempt, 22 on the second, 14 on the third, 16 on the
// fourth and 7 on the fifth. Stopping at three gives up 23 answers and saves
// 270 searches -- and, far more importantly, it is what lets a trail with only
// optional detail outstanding reach approval at all.
const MAX_WAIVABLE_ATTEMPTS = 3;
// Hours to wait before the *next* research strategy may be claimed. These are
// not failure backoff. A job that errors is rescheduled by `failJob`, which
// carries its own 1/6/24-minute ladder plus a 30-minute hold for a provider
// outage that costs the job nothing from its failure budget. What these delays
// pace is a strategy that ran, returned, and found nothing — and a materially
// different search of the same web does not need three days to answer
// differently.
//
// They read [0, 1, 6, 24, 72] until 2026-10-07: 103 hours of mandated waiting
// per claim that walked the full ladder, and a trail cannot leave
// evidence-resolution until its slowest claim is terminal. Measured that
// morning: 15 trails in evidence-resolution with the oldest 18 days, and 33 of
// 109 queued jobs unclaimable with the furthest 70 hours out — enough that the
// verification drain finds nothing to claim, reads the queue as idle and exits
// reporting success while a third of it waits.
//
// Eight hours keeps the one property the tail genuinely had: the final targeted
// search is not issued seconds after the fourth against the same index.
const RETRY_DELAYS_HOURS = Object.freeze([0, 0, 1, 1, 6]);
const TERMINAL_STATES = Object.freeze([
  'supported', 'contradicted', 'source-exhausted',
  'contact-required', 'field-check-required',
]);

/**
 * How many attempts this claim gets.
 *
 * The caller says whether the claim is unwaivable, because which claims those
 * are is the dossier's business, not this contract's. Anything that does not
 * say is treated as optional, so a caller that has not been taught the
 * difference shortens a ladder rather than silently granting a full one to a
 * claim that should not have it.
 */
function attemptCeiling(options = {}){
  return options.unwaivable ? MAX_AUTOMATED_ATTEMPTS : MAX_WAIVABLE_ATTEMPTS;
}

function resolutionStatus(attempts, claimState, options = {}){
  const history = Array.isArray(attempts) ? attempts : [];
  if(['supported', 'contradicted'].includes(claimState)) return claimState;
  if(history.length >= attemptCeiling(options)) return 'source-exhausted';
  return 'researchable';
}

function assertNextStrategy(attempts, strategy, options = {}){
  const history = Array.isArray(attempts) ? attempts : [];
  const ceiling = attemptCeiling(options);
  if(history.length >= ceiling){
    throw new Error(`Automated resolution limit reached (${ceiling})`);
  }
  if(typeof strategy !== 'string' || !strategy.trim()) throw new Error('A research strategy is required');
  if(history.some(attempt => attempt.strategy === strategy)){
    throw new Error('Each automated attempt must use a materially different strategy');
  }
  return {
    attemptNumber: history.length + 1,
    strategy,
    delayHours: RETRY_DELAYS_HOURS[history.length],
  };
}

module.exports = {
  VERSION, MAX_AUTOMATED_ATTEMPTS, MAX_WAIVABLE_ATTEMPTS, RETRY_DELAYS_HOURS,
  TERMINAL_STATES, attemptCeiling, resolutionStatus, assertNextStrategy,
};
