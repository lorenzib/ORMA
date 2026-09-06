#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { fetchRoutesNearPath } = require('../services/osm-relation-client');
const { discoverRouteComposite } = require('../workflows/discover-route-composite');
const { identityContradiction, hasFullGraduation, relationExternalId } = require('../workflows/plan-catalogue-campaign');

// Proposes the waymarked paths a walk follows, for trails whose recorded
// relation covers only part of it. A proposal is evidence for the geometry
// gate, never a decision: an approved composite is only ever written by a human.

const PACE_MS = 2000;

function sleep(milliseconds){ return new Promise(resolve => setTimeout(resolve, milliseconds)); }

async function readJson(file, fallback){
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch(error){ if(error.code !== 'ENOENT') throw error; return fallback; }
}

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const compositesPath = path.join(root, 'backoffice-data', 'route-composites.json');
  const identityPath = path.join(root, 'backoffice-data', 'route-source-identity.json');
  const candidateId = option(args, '--candidate', '');
  const limit = Number(option(args, '--limit', '50'));

  const trails = loadProductionTrails(root);
  const identity = await readJson(identityPath, { checks:{} });
  const ledger = await readJson(compositesPath, { contractVersion:'1.0.0', updatedAt:null, composites:{} });
  ledger.composites = ledger.composites || {};

  const queue = candidateId
    ? trails.filter(trail => trail.id === candidateId)
    : trails.filter(trail => !hasFullGraduation(trail)
        && (!relationExternalId(trail) || identityContradiction(trail, identity.checks, ledger.composites)));
  if(candidateId && !queue.length) throw new Error(`Production trail not found: ${candidateId}`);

  console.log(`[composites] Trails needing a route source: ${queue.length}`);
  let proposed = 0;
  for(const trail of queue.slice(0, limit)){
    // A composite a human has already ruled on is never overwritten by a rerun.
    const existing = ledger.composites[trail.id];
    if(existing && existing.state !== 'proposed'){
      console.log(`[composites] ${trail.id} · ${existing.state}, left alone`);
      continue;
    }
    try{
      const { payload } = await fetchRoutesNearPath(trail.path);
      const found = discoverRouteComposite(trail, payload);
      if(!found || !found.relations.length){
        console.log(`[composites] ${trail.id} · no route relation follows this walk`);
      }else{
        ledger.composites[trail.id] = {
          state:'proposed', proposedAt:new Date().toISOString(), trailName:trail.name,
          coveragePercent:found.coveragePercent, radiusMetres:found.radiusMetres,
          candidateRelationCount:found.candidateRelationCount, relations:found.relations,
        };
        proposed += 1;
        const refs = found.relations.map(entry => entry.ref || entry.externalRelationId).join(' + ');
        console.log(`[composites] ${trail.id} · ${found.coveragePercent}% via ${found.relations.length} path(s): ${refs}`);
      }
    }catch(error){
      console.log(`[composites] ${trail.id} · lookup failed: ${error.message}`);
    }
    await sleep(PACE_MS);
  }

  ledger.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(compositesPath), { recursive: true });
  await fs.writeFile(compositesPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  console.log(`[composites] Proposed: ${proposed}`);
  console.log('[composites] Every proposal awaits geometry approval; none is a route source yet.');
  console.log(`[composites] Ledger: ${compositesPath}`);
}

if(require.main === module){
  main().catch(error => { console.error(`[composites] ${error.message}`); process.exit(1); });
}

module.exports = { main };
