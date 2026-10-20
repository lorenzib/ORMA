#!/usr/bin/env node
'use strict';

/**
 * resurvey-trails — survey a named trail again, because the surveyor got better.
 *
 *   npm run backoffice:resurvey -- --trails osm-6250300,osm-11517208
 *   npm run backoffice:resurvey -- --trails osm-6250300 --apply
 *
 * Dry run by default. The geometry audit is deterministic -- it reads
 * OpenStreetMap and measures -- so this costs no model credits, only the
 * Firestore reads of a worker pass.
 *
 * A re-survey is not an approval and not a reconsideration. The trail stays
 * exactly where it is; only its survey is taken again, and the newest one is
 * what every reader already uses. Research already paid for is untouched.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { planResurvey, withAnotherSurvey, surveyAttempt, surveyedBeforeTheMarks } = require('../workflows/resurvey-named-trails');
const { compactOrchestration } = require('../workflows/advance-trail-orchestration');
const { specialistJob } = require('../workflows/apply-dossier-review');

function parseArgs(argv){
  const out = { trails: [], apply: false, stale: false };
  for(let i = 0; i < argv.length; i += 1){
    const arg = String(argv[i]);
    if(arg === '--trails'){ out.trails = String(argv[i += 1] || '').split(','); continue; }
    if(arg.startsWith('--trails=')){ out.trails = arg.slice('--trails='.length).split(','); continue; }
    if(arg === '--apply'){ out.apply = true; continue; }
    // Ask the record which walks were surveyed before the surveyor learned to
    // record what it found, instead of naming them from a report that is out
    // of date the next morning.
    if(arg === '--stale'){ out.stale = true; continue; }
  }
  out.trails = out.trails.map(id => String(id).trim()).filter(Boolean);
  return out;
}

/**
 * The newest stored output per trail, read one trail at a time.
 *
 * `latestOutputRef` is what the orchestration keeps, and the artifact behind
 * it is the full survey -- not the queue's summary, which is trimmed. A trail
 * with no ref has nothing to read and is reported as never surveyed.
 */
async function surveysByTrail(store, orchestration){
  const outputs = new Map();
  for(const trail of orchestration?.trails || []){
    const key = String(trail.trailId || trail.candidateId);
    const ref = String(trail.latestOutputRef || '');
    if(!ref.startsWith('firestore:')){ outputs.set(key, []); continue; }
    const stored = await store.getArtifact(ref.slice('firestore:'.length));
    // The ref names the newest output of any agent, so it is a survey only
    // when the cartographer wrote it. Anything else leaves the trail with no
    // survey to judge, which is the safe reading: it is reported as never
    // surveyed rather than as current.
    outputs.set(key, stored ? [{ agentId: agentOf(ref, stored), jobId: ref, completedAt: stored.completedAt || null, result: stored }] : []);
  }
  return outputs;
}

/** Whose output this is. A geometry survey is the one that carries a source relation. */
function agentOf(ref, stored){
  if(/cartographer/i.test(ref)) return 'cartographer';
  return stored && stored.source && stored.geometry ? 'cartographer' : 'unknown';
}

async function main(options = {}){
  const args = parseArgs(options.argv || process.argv.slice(2));
  const at = options.at || new Date().toISOString();
  const store = options.store || new FirestoreBackofficeStore();
  if(!args.trails.length && !args.stale){
    console.log('[resurvey] Name the trails with --trails <id>,<id>, or ask the record with --stale. Nothing was changed.');
    return null;
  }
  const orchestration = await store.getArtifact('trail-orchestration');
  if(!orchestration){ console.log('[resurvey] No orchestration artifact.'); return null; }

  let ids = args.trails;
  if(args.stale){
    // One read per trail, and no model call at all. The reads are the only
    // cost of asking, and the command is a dry run until `--apply`, so the
    // list is seen before anything is queued.
    const outputs = await surveysByTrail(store, orchestration);
    const found = surveyedBeforeTheMarks(orchestration, outputs);
    console.log(`[resurvey] ${found.current.length} walk(s) carry a survey that says what it found;`
      + ` ${found.stale.length} were surveyed before the surveyor recorded it;`
      + ` ${found.neverSurveyed.length} have never been surveyed and are already owed one.`);
    for(const entry of found.stale){
      console.log(`[resurvey]   stale: ${entry.trailName} (${entry.candidateId}) · at ${entry.state}`);
    }
    if(!found.stale.length){
      console.log('[resurvey] Every walk in the pipeline has a survey that says what it found. Nothing was changed.');
      return { stale: [], current: found.current, neverSurveyed: found.neverSurveyed };
    }
    ids = [...new Set([...ids, ...found.stale.map(entry => entry.candidateId)])];
  }

  const plan = planResurvey(orchestration, ids);
  for(const entry of plan.unknown) console.log(`[resurvey] Not in the pipeline: ${entry}`);
  for(const entry of plan.surveying){
    console.log(`[resurvey] Already at the survey, nothing to queue: ${entry.trailName} (${entry.candidateId})`);
  }
  for(const entry of plan.resting){
    console.log(`[resurvey] Resting as ${entry.state}, so not waiting on a survey: ${entry.trailName} (${entry.candidateId})`);
  }
  for(const entry of plan.queueing){
    console.log(`[resurvey]   ${entry.trailName} (${entry.candidateId}) · at ${entry.state} · a fresh survey queued, the trail stays put`);
  }
  if(!plan.queueing.length){ console.log('[resurvey] Nothing to queue. Nothing was changed.'); return plan; }
  if(!args.apply){
    console.log(`[resurvey] Dry run. Nothing was changed. Re-run with --apply to queue ${plan.queueing.length} survey(s).`);
    return plan;
  }

  const next = JSON.parse(JSON.stringify(orchestration));
  const queued = [];
  for(const entry of plan.queueing){
    const index = next.trails.findIndex(trail => String(trail.candidateId) === String(entry.candidateId));
    if(index < 0) continue;
    const trail = next.trails[index];
    const job = specialistJob(trail, { agentId: 'cartographer', action: 'audit-route-geometry', claimIds: [] },
      surveyAttempt(trail), at);
    next.trails[index] = withAnotherSurvey(trail, job.id);
    queued.push(job);
  }
  for(const job of queued) await store.putJob(job);
  await store.setArtifact('trail-orchestration', compactOrchestration(next));
  console.log(`[resurvey] Queued ${queued.length} survey(s). No model credits: the surveyor reads the map and measures.`);
  console.log('[resurvey] Each trail stayed where it was; the newest survey is what the gate reads.');
  return { ...plan, queued: queued.map(job => job.id) };
}

if(require.main === module) main().catch(error => { console.error(`[resurvey] ${error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, surveysByTrail, main };
