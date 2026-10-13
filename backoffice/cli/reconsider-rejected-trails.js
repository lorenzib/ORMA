#!/usr/bin/env node
'use strict';

/**
 * reconsider-rejected-trails — look again at a trail rejected under a rule that
 * has since changed.
 *
 *   npm run backoffice:reconsider                                   (lists why trails were rejected)
 *   npm run backoffice:reconsider -- --reason not-closed-loop
 *   npm run backoffice:reconsider -- --reason not-closed-loop --apply
 *
 * Dry run by default. The reason must be named: most rejected trails were
 * rejected correctly, and sending those back spends the model budget to reach
 * the same verdict. Bounded per pass for the same reason.
 *
 * Sending a trail back is not approving it. It returns to the audit that
 * rejected it and is judged again by whatever the rules now are.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { planReconsideration, returnedTrail } = require('../workflows/reconsider-rejected-trails');
const { compactOrchestration } = require('../workflows/advance-trail-orchestration');
const { specialistJob } = require('../workflows/apply-dossier-review');

function parseArgs(argv){
  const out = { reason:'', limit:10, apply:false };
  for(let i = 0; i < argv.length; i += 1){
    const arg = String(argv[i]);
    if(arg === '--reason'){ out.reason = argv[i += 1]; continue; }
    if(arg.startsWith('--reason=')){ out.reason = arg.slice('--reason='.length); continue; }
    if(arg === '--limit'){ out.limit = Number.parseInt(argv[i += 1], 10) || 10; continue; }
    if(arg === '--apply'){ out.apply = true; continue; }
  }
  return out;
}

async function main(options = {}){
  const args = parseArgs(options.argv || process.argv.slice(2));
  const store = options.store || new FirestoreBackofficeStore();
  const at = options.at || new Date().toISOString();

  const orchestration = await store.getArtifact('trail-orchestration');
  if(!orchestration){ console.log('[reconsider] No orchestration artifact.'); return null; }
  const plan = planReconsideration(orchestration, args);

  if(!args.reason){
    console.log(`[reconsider] ${plan.rejected} rejected trail(s). Name one of these with --reason:`);
    for(const row of plan.reasons) console.log(`[reconsider]   ${row.count}x ${row.reason}`);
    console.log('[reconsider] Nothing was changed.');
    return plan;
  }

  console.log(`[reconsider] ${plan.rejected} rejected · sending back ${plan.returning.length}, holding ${plan.held} over the limit.`);
  for(const entry of plan.returning){
    console.log(`[reconsider]   ${entry.trailName} (${entry.candidateId}) → ${entry.state}, ${entry.agentId} looks again`);
    console.log(`[reconsider]       matched: ${entry.matched.join('; ')}`);
  }
  if(!plan.returning.length){ console.log('[reconsider] Nothing matched. Nothing was changed.'); return plan; }
  if(!args.apply){
    console.log('[reconsider] Dry run. Nothing was changed. Re-run with --apply to send these back.');
    return plan;
  }

  const next = JSON.parse(JSON.stringify(orchestration));
  const queued = [];
  for(const entry of plan.returning){
    const index = next.trails.findIndex(trail => String(trail.candidateId) === String(entry.candidateId));
    if(index < 0) continue;
    const trail = next.trails[index];
    const updated = returnedTrail(trail, entry, at);
    const job = specialistJob(updated, { agentId: entry.agentId, action: entry.action, claimIds: [] },
      updated.attempts[entry.agentId], at);
    updated.jobIds = [...(updated.jobIds || []), job.id];
    next.trails[index] = updated;
    queued.push(job);
  }
  for(const job of queued) await store.putJob(job);
  await store.setArtifact('trail-orchestration', compactOrchestration(next));
  console.log(`[reconsider] Sent ${queued.length} trail(s) back and queued a fresh pass for each.`);
  console.log('[reconsider] They are judged again from scratch; a trail that still fails is rejected again.');
  return { ...plan, queued: queued.map(job => job.id) };
}

if(require.main === module) main().catch(error => { console.error(`[reconsider] ${error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, main };
