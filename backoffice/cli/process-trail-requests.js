#!/usr/bin/env node
'use strict';

/**
 * process-trail-requests — carry out what the trail board asked for.
 *
 *   npm run backoffice:trail-requests
 *
 * Run every fifteen minutes by the ORMA trail requests workflow, which holds
 * the Firestore credential and a token allowed to dispatch workflows. A pass:
 *
 *   1. settles requests dispatched earlier, from the run each one started;
 *   2. dispatches the requests still queued, one run per workflow at most;
 *   3. refreshes the trail board, only if anything changed.
 *
 * With nothing queued and nothing in flight it costs two Firestore reads and
 * stops. It never writes the orchestration: every action is an input to the
 * worker or the requeue workflow, which keep their own concurrency rules.
 */

const path = require('path');
const { spawnSync } = require('child_process');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { planRequestPass, runForDispatch, settleDispatched, WORKFLOW_FILES } = require('../workflows/trail-requests');
const { buildTrailBoard } = require('../workflows/build-trail-board');

function gh(args){
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if(result.error) throw result.error;
  if(result.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')} failed: ${(result.stderr || '').trim().slice(0, 400)}`);
  return (result.stdout || '').trim();
}

function recentRuns(file){
  const out = gh(['run', 'list', '--workflow', file, '--event', 'workflow_dispatch', '--limit', '20',
    '--json', 'databaseId,status,conclusion,createdAt,event,url']);
  return out ? JSON.parse(out) : [];
}

function dispatch(file, inputs){
  const args = ['workflow', 'run', file];
  for(const [key, value] of Object.entries(inputs)) args.push('-f', `${key}=${value}`);
  gh(args);
}

function iso(value){
  if(!value) return null;
  if(typeof value.toDate === 'function') return value.toDate().toISOString();
  if(value.seconds) return new Date(value.seconds * 1000).toISOString();
  return new Date(value).toISOString();
}

async function main(options = {}){
  const store = options.store || new FirestoreBackofficeStore();
  const now = options.now || new Date().toISOString();
  const runs = options.runs || ((file) => recentRuns(file));
  const send = options.dispatch || dispatch;
  const [queued, dispatched] = await Promise.all([store.listTrailRequests('queued'), store.listTrailRequests('dispatched')]);
  if(!queued.length && !dispatched.length){
    console.log('[trail-requests] Nothing asked for. Nothing was changed.');
    return { settled: 0, dispatched: 0, refused: 0 };
  }
  let changed = 0;

  // 1. Settle what earlier passes started.
  const runsByWorkflow = new Map();
  const runsFor = file => { if(!runsByWorkflow.has(file)) runsByWorkflow.set(file, runs(file)); return runsByWorkflow.get(file); };
  for(const request of dispatched){
    const file = WORKFLOW_FILES[request.workflow];
    if(!file) continue;
    const run = request.runId
      ? runsFor(file).find(item => String(item.databaseId) === String(request.runId)) || null
      : runForDispatch(runsFor(file), iso(request.dispatchedAt));
    const settled = settleDispatched({ ...request, dispatchedAt: iso(request.dispatchedAt) }, run, now);
    if(!settled) continue;
    if(settled.unchanged){
      if(!request.runId && settled.runId){ await store.markTrailRequest(request.id, 'dispatched', { runId: settled.runId, runUrl: settled.runUrl }); }
      continue;
    }
    const { status, ...fields } = settled;
    await store.markTrailRequest(request.id, status, { ...fields, settledAt: now });
    console.log(`[trail-requests] ${request.action} ${request.trailId}: ${status}${fields.note ? ` · ${fields.note}` : ''}`);
    changed += 1;
  }

  // 2. Dispatch what is waiting. Refused requests are answered, never dropped.
  // A request settled back to queued above (its run was replaced) is picked
  // up again on the next pass, not this one: its run may still be finishing.
  const stillQueued = queued;
  let board = null;
  if(stillQueued.length){
    board = await store.getArtifact('trail-board');
    const plan = planRequestPass({ queued: stillQueued, board });
    for(const { request, reason } of plan.refused){
      await store.markTrailRequest(request.id, 'refused', { note: reason, settledAt: now });
      console.log(`[trail-requests] refused ${request.action} ${request.trailId}: ${reason}`);
      changed += 1;
    }
    for(const item of plan.dispatches){
      const at = new Date().toISOString();
      try{
        send(item.file, item.inputs);
      }catch(error){
        console.error(`[trail-requests] could not start ${item.file}: ${error.message}`);
        continue;
      }
      for(const request of item.requests){
        await store.markTrailRequest(request.id, 'dispatched', { workflow: item.workflow, dispatchedAt: at,
          inputs: item.inputs });
        changed += 1;
      }
      console.log(`[trail-requests] started ${item.file} for ${item.requests.length} request(s): ${JSON.stringify(item.inputs)}`);
    }
    if(plan.waiting.length) console.log(`[trail-requests] ${plan.waiting.length} request(s) wait for the next pass.`);
  }

  // 3. Refresh the board so the page shows the request's effect without
  // waiting for the next worker pass. Skipped when nothing moved.
  if(changed && options.refreshBoard !== false){
    try{
      const [orchestration, publicationRequests] = await Promise.all([
        store.getArtifact('trail-orchestration'), store.getArtifact('publication-requests')]);
      const next = buildTrailBoard({ trails: options.trails || loadProductionTrails(path.resolve(__dirname, '../..')),
        orchestration, publicationRequests, jobs: await store.listJobs(['queued', 'running']), at: now });
      await store.setArtifact('trail-board', next, { trails: next.summary.trails, stuck: next.summary.stuck });
    }catch(error){
      console.error(`[trail-requests] board not refreshed: ${error.message}`);
    }
  }
  return { changed };
}

if(require.main === module) main().catch(error => { console.error(`[trail-requests] ${error.message}`); process.exitCode = 1; });

module.exports = { main };
