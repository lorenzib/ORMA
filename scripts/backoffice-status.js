#!/usr/bin/env node
'use strict';

/**
 * backoffice-status.js — one consolidated backoffice status.
 *
 * Answers three questions the desks scatter across pages:
 *   1. What is gated by your approval?
 *   2. How many trails are left to verify?
 *   3. How far along are the agents?
 *
 * Read-only. Uses live Firestore when credentials are present (same store the
 * backoffice CLIs use); otherwise falls back to the committed
 * backoffice-data/*.json snapshots (dated, possibly stale) and always reports
 * the live local trail catalogue for the verification counts.
 *
 * Usage: npm run backoffice:status
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// True only when Firestore credentials are actually configured. Checked before
// touching firebase-admin, because applicationDefault() with no credentials
// rejects on a detached promise that a local try/catch cannot contain.
function credentialsAvailable() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) return true;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return true;
  if (process.env.FIRESTORE_EMULATOR_HOST) return true;
  return fs.existsSync(path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json'));
}

// --- 1. Trail catalogue tiers: always current, no credentials needed --------
function catalogueCounts() {
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'trail-trust.js'), 'utf8'), ctx);
  const trust = ctx.window.DoloPawsTrailTrust;
  let trails = new Function(fs.readFileSync(path.join(ROOT, 'trails-data.js'), 'utf8') + '\nreturn trails;')();
  for (const file of ['osm-trails-data.js', 'osm-trails-savoy-data.js']) {
    const match = fs.readFileSync(path.join(ROOT, file), 'utf8').match(/const imported = (\[[\s\S]*?\]);/);
    if (match) trails = trails.concat(JSON.parse(match[1]));
  }
  const tiers = { 'under-review': 0, 'route-audited': 0, 'dolopaws-walked': 0 };
  for (const trail of trails) {
    const tier = trust.tierOf(trail);
    tiers[tier] = (tiers[tier] || 0) + 1;
  }
  return { total: trails.length, tiers };
}

// --- 2. Data source: live Firestore, else committed snapshots ---------------
async function makeSource() {
  const readSnapshot = (id) => {
    const file = path.join(ROOT, 'backoffice-data', `${id}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  };
  const snapshotSource = (reason) => {
    let date = null;
    for (const id of ['trail-orchestration', 'route-review', 'dossier-review-queue', 'verified-trail-editorial-queue']) {
      const artifact = readSnapshot(id);
      const ts = artifact && (artifact.generatedAt || artifact.updatedAt);
      if (ts && (!date || ts > date)) date = ts;
    }
    return { mode: 'snapshot', reason, date, getArtifact: async (id) => readSnapshot(id), listJobs: async () => null };
  };
  if (!credentialsAvailable()) return snapshotSource('no Firestore credentials found');
  try {
    const { FirestoreBackofficeStore } = require('../backoffice/services/firestore-backoffice-store');
    const store = new FirestoreBackofficeStore();
    await store.getArtifact('trail-orchestration'); // probe: fail over to snapshot if creds are stale
    return { mode: 'live', getArtifact: (id) => store.getArtifact(id), listJobs: (s) => store.listJobs(s) };
  } catch (error) {
    return snapshotSource(error.message);
  }
}

function tally(list, pick) {
  const counts = new Map();
  for (const item of list || []) {
    const key = pick(item) || '(none)';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function buildStatus() {
  const catalogue = catalogueCounts();
  const source = await makeSource();
  const [orchestration, dossier, route, editorial] = await Promise.all([
    source.getArtifact('trail-orchestration'),
    source.getArtifact('dossier-review-queue'),
    source.getArtifact('route-review'),
    source.getArtifact('verified-trail-editorial-queue'),
  ]);
  const jobs = await source.listJobs(['queued', 'running', 'ready-for-review', 'blocked']);

  const dossierGates = ((dossier && dossier.items) || []).filter((i) => i.state === 'awaiting-human');
  // Route items that need you: an explicit human gate, or one where automation
  // has exhausted its sources and is waiting on your direct confirmation.
  const routeGates = (((route && route.items)) || []).filter((i) =>
    /human|direct-confirmation/i.test(i.reviewState || ''));
  const editorialItems = (editorial && (editorial.items || editorial.queue)) || [];
  const editorialGates = editorialItems.flatMap((i) =>
    (i.humanGates || []).filter((g) => g.status === 'pending').map((g) => ({ trail: i.trailName, gate: g.id })));

  return { catalogue, source, orchestration, jobs, dossierGates, routeGates, editorialGates };
}

function printStatus(s) {
  const c = s.catalogue;
  const backlog = c.tiers['under-review'] || 0;
  const src = s.source.mode === 'live'
    ? 'LIVE (Firestore)'
    : `SNAPSHOT (backoffice-data${s.source.date ? `, generated ${s.source.date}` : ''} — may be stale)`;

  console.log(`\nORMA backoffice status  ·  ${src}\n${'─'.repeat(64)}`);

  console.log('\nTRAILS TO VERIFY');
  console.log(`  ${c.total} total  ·  ${c.tiers['route-audited']} route-audited  ·  ${backlog} under review  ·  ${c.tiers['dolopaws-walked']} walked`);
  console.log(`  Verification backlog: ${backlog} trails`);

  console.log('\nGATED BY YOU');
  if (s.routeGates.length) {
    console.log(`  Route decisions (${s.routeGates.length}):`);
    s.routeGates.forEach((i) => console.log(`    · ${i.title || i.candidateId}   [${i.reviewState}]`));
  }
  if (s.dossierGates.length) {
    const ready = s.dossierGates.filter((i) => i.approvalAllowed);
    console.log(`  Dossier geometry gates (${s.dossierGates.length}): ${ready.length} ready to approve · ${s.dossierGates.length - ready.length} need judgement`);
    tally(s.dossierGates, (i) => i.gateType).forEach(([g, n]) => console.log(`    · ${n}× ${g}`));
  }
  if (s.editorialGates.length) {
    console.log(`  Editorial / publication gates (${s.editorialGates.length} pending)  ⚠ editorial lane may be paused (Safety Library review)`);
    tally(s.editorialGates, (g) => g.gate).forEach(([g, n]) => console.log(`    · ${n}× ${g}`));
  }
  if (!s.routeGates.length && !s.dossierGates.length && !s.editorialGates.length) {
    console.log('  Nothing is waiting on you.');
  }

  console.log('\nAGENT PROGRESS');
  if (Array.isArray(s.jobs)) {
    if (!s.jobs.length) console.log('  No queued or running agent jobs.');
    tally(s.jobs, (j) => `${j.jobType || j.agentId || 'job'}:${j.status}`).forEach(([k, n]) => console.log(`    · ${n}× ${k}`));
  } else if (s.orchestration && s.orchestration.summary) {
    const sum = s.orchestration.summary;
    console.log(`  ${sum.trails || 0} trails in the pipeline · ${sum.running || 0} running · ${sum.awaitingHuman || 0} awaiting human`);
    Object.entries(sum.states || {}).forEach(([state, n]) => console.log(`    · ${n}× ${state}`));
    if (s.source.mode === 'snapshot') console.log('  (live agent-job detail needs Firestore credentials; run where ADC / FIREBASE_SERVICE_ACCOUNT is set)');
  } else {
    console.log('  Unavailable (needs live Firestore access).');
  }
  console.log('\nRead-only. Nothing was changed.\n');
}

async function main() {
  const status = await buildStatus();
  printStatus(status);
  return status;
}

if (require.main === module) {
  main().catch((error) => { console.error(`[backoffice-status] ${error.stack || error.message}`); process.exitCode = 1; });
}

module.exports = { catalogueCounts, buildStatus, tally };
