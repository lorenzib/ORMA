#!/usr/bin/env node
'use strict';

/**
 * report-job-queue — why the queue is long and nothing is running.
 *
 *   npm run backoffice:job-queue
 *
 * Read-only. Prints how many queued jobs can actually be claimed right now,
 * what is holding the rest, and — the part no other report answers — whether
 * the head of the queue is unclaimable, because the worker takes the oldest
 * jobs per pass and stops there.
 */

const path = require('path');
const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { PROCESSABLE_JOB_TYPES } = require('../workflows/run-live-backoffice-worker');
const { summariseJobQueue } = require('../workflows/job-queue-health');
const { loadProductionTrails } = require('../../scripts/load-production-trails');

function positiveInteger(value, fallback){
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(options = {}){
  const store = options.store || new FirestoreBackofficeStore();
  const root = path.resolve(__dirname, '../..');
  const trails = options.productionTrails || loadProductionTrails(root);
  const intake = await store.getArtifact('new-trail-intake');
  const trailIds = new Set([...trails, ...((intake && intake.candidates) || [])].map(trail => trail.id));
  const jobs = await store.listJobs(['queued']);
  const report = summariseJobQueue(jobs, {
    processableJobTypes: PROCESSABLE_JOB_TYPES,
    trailIds,
    headCount: positiveInteger(process.env.ORMA_SPECIALIST_LIMIT, 10),
  });

  if(process.argv.includes('--json')){ console.log(JSON.stringify(report, null, 2)); return report; }

  console.log(`[queue] ${report.queued} queued job(s) · ${report.claimableNow} can be claimed right now.`);
  for(const entry of report.byReason) console.log(`[queue]   ${entry.count}x ${entry.reason}`);
  console.log(`[queue] The worker takes the ${report.head.count} oldest per pass; ${report.head.claimable} of those can be claimed.`);
  for(const job of report.head.jobs){
    const until = job.until ? ` · waits until ${job.until} (${job.inMinutes} min)` : '';
    console.log(`[queue]   ${job.status.padEnd(24)} ${job.jobType} · ${job.candidateId || 'no candidate'}${until}`);
  }
  if(report.starved){
    console.log('[queue] STARVED: nothing at the head can be claimed, while claimable work waits behind it.');
    console.log('[queue] The pass will report "no agent work to pick up" however long the queue is.');
  }
  if(report.soonestClaimable !== null){
    console.log(`[queue] Soonest scheduled job runs in ${report.soonestClaimable} min; the furthest in ${report.latestSchedule} min.`);
  }
  console.log('[queue] Nothing was changed.');
  return report;
}

if(require.main === module) main().catch(error => { console.error(`[queue] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { main };
