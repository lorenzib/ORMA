'use strict';

const VERSION = '1.0.0';
const MAX_AUTOMATED_ATTEMPTS = 5;
const RETRY_DELAYS_HOURS = Object.freeze([0, 1, 6, 24, 72]);
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
