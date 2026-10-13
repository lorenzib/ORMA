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

function parseArgs(argv){
  let trail = null;
  for(let i = 0; i < argv.length; i += 1) if(argv[i] === '--trail') trail = argv[i += 1];
  return { trail };
}

async function main(options = {}){
  const { trail: trailId } = parseArgs(options.argv || process.argv.slice(2));
  if(!trailId){ console.error('[geometry] --trail <id> is required.'); process.exitCode = 1; return null; }
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

if(require.main === module) main().catch(error => { console.error(`[geometry] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, main };
