#!/usr/bin/env node
'use strict';

// Read-only. gate-evidence counts and names the blockers; this prints the
// specialists' own words for one trail -- each claim's proposedValue, finding,
// rationale, sources and blockers -- so a contradiction (finding
// "counter-evidence") can be read verbatim before a gate is judged on it.
//
//   node backoffice/cli/dump-dossier-claims.js --trail=osm-16363583
//   node backoffice/cli/dump-dossier-claims.js --trail=osm-16363583 --claim=waymark
//   node backoffice/cli/dump-dossier-claims.js --trail=osm-16363583 --agent=evidenceLibrarian --all

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');

function arg(argv, name) { const hit = argv.find(a => a.startsWith(`--${name}=`)); return hit ? hit.split('=').slice(1).join('=') : null; }

function printClaim(agentId, claim) {
  const srcs = (claim.sources || []).map(s => `          - ${s.authority || '?'} · ${s.label || ''} ${s.url || ''}${s.accessedAt ? ` (read ${String(s.accessedAt).slice(0, 10)})` : ''}`);
  console.log(`  [${agentId}] ${claim.id} · ${claim.category || '?'} · FINDING=${claim.finding}${claim.confidence != null ? ` · conf ${claim.confidence}` : ''}`);
  if (claim.proposedValue) console.log(`      value: ${claim.proposedValue}`);
  if (claim.variesWith) console.log(`      variesWith: ${claim.variesWith}`);
  if (claim.rationale) console.log(`      rationale: ${claim.rationale}`);
  if ((claim.blockers || []).length) { console.log(`      blockers:`); for (const b of claim.blockers) console.log(`        - ${b}`); }
  if (srcs.length) { console.log(`      sources (${srcs.length}):`); console.log(srcs.join('\n')); }
  console.log('');
}

async function main() {
  const argv = process.argv.slice(2);
  const trail = arg(argv, 'trail');
  if (!trail) { console.error('[dump] --trail=<candidateId> is required.'); process.exit(1); }
  const claimFilter = (arg(argv, 'claim') || '').toLowerCase();
  const agentFilter = (arg(argv, 'agent') || '').toLowerCase();
  const showAll = argv.includes('--all'); // default hides supported-proposal claims

  const store = new FirestoreBackofficeStore();
  const queue = await store.getArtifact('dossier-review-queue') || { items: [] };
  const item = (queue.items || []).find(i => String(i.candidateId) === trail || String(i.trailId) === trail);
  if (!item) { console.error(`[dump] No dossier-review-queue item for ${trail}.`); process.exit(1); }

  console.log(`[dump] ${item.trailName || item.candidateId} (${item.candidateId}) · gate ${item.gateType} · state ${item.state}`);
  const outputs = item.specialistOutputs || [];
  console.log(`[dump] ${outputs.length} specialist output(s). Showing ${showAll ? 'all' : 'non-supported'} claims${agentFilter ? ` · agent~${agentFilter}` : ''}${claimFilter ? ` · claim~${claimFilter}` : ''}.\n`);

  for (const output of outputs) {
    if (agentFilter && !String(output.agentId || '').toLowerCase().includes(agentFilter)) continue;
    const result = output.result || output;
    const claims = result.claims || [];
    const shown = claims.filter(c =>
      (showAll || c.finding !== 'supported-proposal') &&
      (!claimFilter || String(c.id || '').toLowerCase().includes(claimFilter) || String(c.category || '').toLowerCase().includes(claimFilter)));
    if (!shown.length) continue;
    if (result.recommendation) console.log(`=== ${output.agentId} — recommendation: ${result.recommendation} ===`);
    if (result.summary && (claimFilter || agentFilter)) console.log(`    summary: ${result.summary}\n`);
    for (const claim of shown) printClaim(output.agentId, claim);
    const oq = result.openQuestions || [];
    if (oq.length && (agentFilter || !claimFilter)) { console.log(`    open questions (${output.agentId}):`); for (const q of oq) console.log(`      ? ${q}`); console.log(''); }
  }
  console.log('[dump] Read-only. Nothing was changed.');
}

if (require.main === module) main().catch(e => { console.error(`[dump] ${e.stack || e.message}`); process.exit(1); });

module.exports = { printClaim };
