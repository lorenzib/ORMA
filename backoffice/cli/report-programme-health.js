#!/usr/bin/env node
'use strict';

/**
 * report-programme-health — what the catalogue-verification lane costs, owes and
 * cannot decide its way out of.
 *
 *   npm run backoffice:programme-health
 *
 * Read-only. Reads the `programme-health` artifact the worker writes each pass,
 * so it costs one document rather than re-deriving anything.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');

function pct(part, whole){ return whole ? `${Math.round((part / whole) * 100)}%` : '—'; }

function render(health){
  if(!health){
    console.log('[programme] No programme-health artifact yet; the next worker pass writes one.');
    return;
  }
  if(health.error){ console.log(`[programme] The last summary failed: ${health.error}`); return; }

  const t = health.throughput;
  console.log(`[programme] ${health.programme} · as of ${health.generatedAt}`);
  console.log(`[programme] THROUGHPUT  ${t.inPipeline} in the pipeline · ${t.verified ?? 0} verified · ${t.readyForEditorial} ready for editorial · ${t.inRedTeam} at red team · ${t.stalled} stalled`);
  for(const stage of t.stages.filter(row => row.trails)){
    const oldest = stage.oldestDaysInState === null ? '' : ` · oldest ${stage.oldestDaysInState}d`;
    console.log(`[programme]   ${String(stage.state).padEnd(20)} ${String(stage.trails).padStart(3)}${oldest}`);
  }
  for(const trail of t.terminal || []){
    console.log(`[programme]   ${trail.state} ${trail.candidateId} · ${trail.daysInState}d · ${(trail.blockers || []).join(', ') || 'no blocker recorded'}`);
  }

  const g = health.evidenceGaps;
  console.log('');
  console.log(`[programme] EVIDENCE GAPS  ${g.open} claim(s) still owed · ${g.unwaivableOpen} that no decision can clear · ${g.waivableOpen} a moderator could judge`);
  console.log('[programme]   the unwaivable ones are the queue; the rest are a judgement call');
  for(const row of g.byClaim.slice(0, 12)){
    const mark = row.unwaivable ? 'UNWAIVABLE' : '          ';
    const first = Object.entries(row.firstFindings).map(([k, v]) => `${k}=${v}`).join(' ');
    const age = row.oldestDays === null ? '' : ` · oldest ${row.oldestDays}d`;
    console.log(`[programme]   ${mark} ${row.claim.padEnd(38)} ${String(row.open).padStart(3)} open${age} · first: ${first}`);
  }

  const r = health.retries;
  console.log('');
  console.log(`[programme] RETRIES  ${r.claims} claim(s) tracked · ${r.exhausted} out of attempts · ${r.neverRetried} never retried · limit ${r.maximumAttempts}`);
  const spent = Object.entries(r.byAttemptsSpent).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([attempts, count]) => `${attempts}:${count}`).join('  ');
  console.log(`[programme]   attempts spent → claims   ${spent}`);
  const paid = Object.entries(r.resolvedAtAttempt).sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([attempt, count]) => `${attempt}:${count}`).join('  ') || 'none';
  console.log(`[programme]   resolved on attempt       ${paid}`);
  // A strategy that has never resolved anything is a fifth of the budget buying
  // nothing, and only this line says so.
  for(const row of r.strategyNeverPaid){
    console.log(`[programme]   attempt ${row.attempt} (${row.strategy}) has never resolved a claim`);
  }

  const c = health.cost;
  console.log('');
  console.log(`[programme] COST  last pass ${c.reads} reads · ${c.writes} writes · ${c.jobsDone} jobs done`);
  console.log(`[programme]   per job ${c.readsPerJob ?? '—'} reads / ${c.writesPerJob ?? '—'} writes · one pass is ${pct(c.reads, c.dailyFreeReads)} of the free daily reads`);
  if(c.passesLeftInFreeReads !== null){
    console.log(`[programme]   the day's free allowance funds about ${c.passesLeftInFreeReads} passes this size`);
  }
  for(const entry of (c.bySource || []).slice(0, 6)){
    console.log(`[programme]   ${String(entry.source).padEnd(24)} ${String(entry.reads).padStart(6)} reads`);
  }

  const f = health.freshness;
  console.log('');
  console.log(`[programme] FRESHNESS  oldest trail in its state ${f.oldestStateDays ?? '—'}d · oldest claim untouched ${f.oldestClaimDays ?? '—'}d · orchestration written ${f.orchestrationUpdatedDays ?? '—'}d ago`);
  console.log('[programme] Nothing was changed.');
}

async function main(options = {}){
  const store = options.store || new FirestoreBackofficeStore();
  const health = await store.getArtifact('programme-health');
  if(process.argv.includes('--json')){ console.log(JSON.stringify(health, null, 2)); return health; }
  render(health);
  return health;
}

if(require.main === module) main().catch(error => { console.error(`[programme] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { main, render };
