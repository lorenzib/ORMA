#!/usr/bin/env node
'use strict';

/**
 * show-geometry-audit -- what the geometry check measured on one trail.
 *
 *   npm run backoffice:geometry-audit -- --trail osm-14864704
 *
 * Read-only: one orchestration artifact and one specialist output. No model
 * call, nothing written. Works after the gate has been decided, which is when
 * the question is usually asked and when every other reader finds nothing.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { latestCartographerJobId, findTrail, readGeometryAudit } = require('../workflows/geometry-audit-read');

// Both spellings, because the repository's other CLIs are called with
// `--trail <id>` and its workflows with `--trail=<id>`: the state workflow used
// the second and this read only the first, so the step ran and reported the
// argument missing on a trail it had been given.
function parseArgs(argv){
  let trail = null;
  for(let i = 0; i < argv.length; i += 1){
    const arg = String(argv[i]);
    if(arg === '--trail'){ trail = argv[i += 1]; continue; }
    if(arg.startsWith('--trail=')) trail = arg.slice('--trail='.length);
  }
  return { trail: trail || null };
}

async function main(options = {}){
  const { trail: trailId } = parseArgs(options.argv || process.argv.slice(2));
  // Thrown rather than setting process.exitCode, because this is called from a
  // test as well as from a shell. Setting it here marked the whole jest process
  // as failed after every test had passed: 3523 passing and exit 1, which reads
  // exactly like a crash and took a CI re-run to tell apart from one.
  if(!trailId) throw new Error('--trail <id> is required.');
  const store = options.store || new FirestoreBackofficeStore();

  const orchestration = await store.getArtifact('trail-orchestration');
  const trail = findTrail(orchestration, trailId);
  if(!trail){ console.log(`[geometry] No orchestrated trail for "${trailId}".`); return null; }

  const jobId = latestCartographerJobId(trail);
  if(!jobId){ console.log(`[geometry] ${trailId} has no cartographer pass on record.`); return null; }

  const output = await store.getArtifact(`trail-specialist-output-${jobId}`);
  const audit = readGeometryAudit(output);
  if(!audit){ console.log(`[geometry] ${trailId}: the cartographer output carries no assessment.`); return null; }

  console.log(`[geometry] ${trailId} · ${trail.state || 'state unknown'} · from ${jobId}`);
  console.log(`[geometry]   verdict        ${audit.status}${audit.issues.length ? ` · ${audit.issues.join(', ')}` : ''}`);
  console.log(`[geometry]   declared shape ${audit.routeShape || '(none — an undeclared route is assumed to be a loop)'}`);
  console.log(`[geometry]   closure test   ${audit.circular ? 'applied' : 'not applied'} · ${audit.isClosed ? 'closes' : 'does not close'}`);
  console.log(`[geometry]   ends apart     ${audit.closureDistanceM} m`);
  console.log(`[geometry]   line           ${audit.distanceKm} km · ${audit.pointCount} points · longest step ${audit.maxSegmentM} m`);
  if(audit.routeConformance){
    const rc = audit.routeConformance;
    console.log(`[geometry]   follows refs   ${rc.status || 'unmeasured'}`
      + (rc.offRouteKm != null ? ` · off for ${rc.offRouteKm} of ${rc.distanceKm} km` : ''));
  }
  console.log('[geometry] Nothing was changed.');
  return audit;
}

// Only the shell entry point decides the process's fate.
if(require.main === module) main().catch(error => {
  console.error(`[geometry] ${error.message}`);
  process.exitCode = 1;
});

module.exports = { parseArgs, main };
