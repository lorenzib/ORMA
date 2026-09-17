'use strict';

// A worker run that could not do any of the work it picked up still exits 0.
// Every lane catches its own errors, and the run's health outcome is derived
// from step exit codes, so "the script ran" was the only question ever asked.
//
// Between 2026-09-12 and 2026-09-17 that reported "healthy" forty times in a
// row while the OpenAI account had no credits: ~390 job attempts, every one of
// them refused, nothing on the desk to say so. The jobs were requeued rather
// than blocked -- correctly, because a provider outage says nothing about the
// work -- so they stayed indistinguishable from jobs that had never been tried.
//
// This measures the second question: of the work this run actually picked up,
// how much of it got done.

const { providerOutage } = require('../services/provider-outage');

// Every agent lane reports one entry per job it claimed, and a job that could
// not run comes back as 'retry-or-blocked'. Community hazard vetting is the
// same kind of model call but reports per report rather than per job.
const FAILED_STATUSES = Object.freeze(['retry-or-blocked', 'vetting-failed']);

/**
 * Job attempts across every lane, found by shape rather than by a list of lane
 * names. The bug this guards against is precisely a lane nobody remembered to
 * register, so a new lane has to count from the day it lands.
 */
function attempts(result = {}){
  const found = [];
  for(const value of Object.values(result || {})){
    if(!Array.isArray(value)) continue;
    for(const entry of value){
      if(entry && typeof entry === 'object' && entry.jobId) found.push(entry);
    }
  }
  for(const entry of result?.communityHazards?.vetted || []){
    if(entry && typeof entry === 'object') found.push(entry);
  }
  return found;
}

function failedAttempt(entry){
  return FAILED_STATUSES.includes(entry?.status);
}

/** The distinct errors behind the failures, commonest first. */
function reasons(failures, limit = 3){
  const counts = new Map();
  for(const failure of failures){
    const key = String(failure.error || 'No error message was captured.').slice(0, 300);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([message, count]) => ({ message, count }));
}

function summariseWorkAttempted(result = {}){
  const all = attempts(result);
  const failures = all.filter(failedAttempt);
  return {
    attempted: all.length,
    succeeded: all.length - failures.length,
    failed: failures.length,
    // Every single failure was the provider refusing to answer. Nothing is
    // wrong with the work and no decision at the desk will move it; the account
    // or the provider has to come back first.
    providerParked: failures.length > 0 && failures.every(failure => providerOutage(failure.error)),
    reasons: reasons(failures),
  };
}

/**
 * 'idle' is not a fault: an empty queue looks exactly like this, and so does a
 * run whose only work was reviews a human had not submitted yet.
 */
function workOutcome(summary){
  if(!summary || !summary.attempted) return 'idle';
  return summary.succeeded > 0 ? 'productive' : 'unproductive';
}

function plural(count, singular){
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

/** What a person needs to read on the desk, without opening a run log. */
function workMessage(summary){
  const outcome = workOutcome(summary);
  if(outcome === 'idle') return 'This run had no agent work to pick up.';
  if(outcome === 'productive'){
    return summary.failed
      ? `${plural(summary.succeeded, 'job')} completed and ${summary.failed} failed.`
      : `${plural(summary.succeeded, 'job')} completed.`;
  }
  const cause = summary.reasons[0]?.message || 'No error message was captured.';
  const parked = summary.providerParked
    ? 'The model provider refused every request, so this is not a fault in the work and no decision here will clear it. '
    : '';
  return `Every job this run attempted failed — ${plural(summary.attempted, 'job')}, none completed. ${parked}Most common cause: ${cause}`;
}

module.exports = { FAILED_STATUSES, attempts, failedAttempt, reasons, summariseWorkAttempted, workOutcome, workMessage };
