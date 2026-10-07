'use strict';

const VERSION = '1.0.0';
const MAX_AUTOMATED_ATTEMPTS = 5;
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

function resolutionStatus(attempts, claimState){
  const history = Array.isArray(attempts) ? attempts : [];
  if(['supported', 'contradicted'].includes(claimState)) return claimState;
  if(history.length >= MAX_AUTOMATED_ATTEMPTS) return 'source-exhausted';
  return 'researchable';
}

function assertNextStrategy(attempts, strategy){
  const history = Array.isArray(attempts) ? attempts : [];
  if(history.length >= MAX_AUTOMATED_ATTEMPTS){
    throw new Error(`Automated resolution limit reached (${MAX_AUTOMATED_ATTEMPTS})`);
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
  VERSION, MAX_AUTOMATED_ATTEMPTS, RETRY_DELAYS_HOURS,
  TERMINAL_STATES, resolutionStatus, assertNextStrategy,
};
