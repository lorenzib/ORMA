'use strict';

// A job that could not run because the model provider was unavailable has told us
// nothing about the job. Counting that as a system failure retires work for a
// reason that has nothing to do with the work — the same distinction the hazard
// watch already draws when it refuses to treat a source outage as "safe".
//
// This matters because job ids are deterministic per trail: once a job is blocked,
// putJobIfAbsent will never recreate it, so a provider outage silently and
// permanently removes trails from the queue.

const OUTAGE_PATTERNS = Object.freeze([
  // Billing and quota: the account cannot call the API at all right now.
  /\bno credits remaining\b/i,
  /\binsufficient[_ ]quota\b/i,
  /\bquota exceeded\b/i,
  /\bbilling\b.*\b(hard limit|not active|inactive)\b/i,
  /\bexceeded your current quota\b/i,
  // Provider-side failures and overload.
  /request failed \(429\)/i,
  /request failed \(5\d\d\)/i,
  /\b(RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED)\b/,
  // The request never reached the provider.
  /\b(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network error|fetch failed)\b/i,
]);

function providerOutage(error){
  const message = String(error?.message || error || '');
  if(!message) return false;
  return OUTAGE_PATTERNS.some(pattern => pattern.test(message));
}

module.exports = { OUTAGE_PATTERNS, providerOutage };
