#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { option } = require('./discover');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { fetchRoutesNearPath } = require('../services/osm-relation-client');
const { discoverRouteComposite, ruleOnComposite, rejectComposite } = require('../workflows/discover-route-composite');
const { ON_ROUTE_PERCENT } = require('../workflows/plan-catalogue-campaign');

// Opens the geometry gate on a proposed composite.
//
// An approval re-measures rather than trusting the proposal. A stored number
// says what was true when discovery ran; approving is the moment the claim
// becomes a route source, and it should rest on what OSM holds now. If the
// coverage cannot be measured, nothing is approved — an unverifiable claim is
// not an approved one.

const PACE_MS = 2000;

function sleep(milliseconds){ return new Promise(resolve => setTimeout(resolve, milliseconds)); }

async function main(args = process.argv.slice(2)){
  const root = path.resolve(__dirname, '..', '..');
  const compositesPath = path.join(root, 'backoffice-data', 'route-composites.json');
  const candidateId = option(args, '--candidate', '');
  const approvedBy = option(args, '--by', 'human-moderator');
  const reject = args.includes('--reject');
  // Trails to leave proposed in a bulk run. A held proposal is untouched, so it
  // can be ruled on separately once whatever is holding it is settled.
  const holdIds = new Set(option(args, '--hold', '').split(',').map(id => id.trim()).filter(Boolean));

  const ledger = JSON.parse(await fs.readFile(compositesPath, 'utf8'));
  ledger.composites = ledger.composites || {};
  const trails = new Map(loadProductionTrails(root).map(trail => [trail.id, trail]));

  const queue = Object.entries(ledger.composites)
    .filter(([trailId, composite]) => composite.state === 'proposed'
      && !holdIds.has(trailId)
      && (!candidateId || trailId === candidateId));
  if(candidateId && !queue.length) throw new Error(`No proposed composite for ${candidateId}`);

  console.log(`[composites] Proposals to rule on: ${queue.length}`);
  for(const trailId of holdIds) console.log(`[composites] ${trailId} · held by request, left proposed`);
  let approved = 0;
  let held = 0;
  for(const [trailId, composite] of queue){
    if(reject){
      const ruled = rejectComposite(composite, { approvedBy });
      ledger.composites[trailId] = ruled.composite;
      console.log(`[composites] ${trailId} · rejected`);
      continue;
    }
    const trail = trails.get(trailId);
    let measured = null;
    if(!trail){
      console.log(`[composites] ${trailId} · held, no production trail`);
      held += 1;
      continue;
    }
    try{
      const { payload } = await fetchRoutesNearPath(trail.path);
      measured = discoverRouteComposite(trail, payload);
    }catch(error){
      console.log(`[composites] ${trailId} · held, could not measure: ${error.message}`);
      held += 1;
      await sleep(PACE_MS);
      continue;
    }
    const ruled = ruleOnComposite(composite, measured, { approvedBy, minimumCoveragePercent:ON_ROUTE_PERCENT });
    ledger.composites[trailId] = ruled.composite;
    if(ruled.outcome === 'approved'){
      approved += 1;
      const refs = ruled.composite.relations.map(entry => entry.ref || entry.externalRelationId).join(' + ');
      console.log(`[composites] ${trailId} · approved at ${ruled.composite.coveragePercent}% via ${refs}`);
    }else{
      held += 1;
      console.log(`[composites] ${trailId} · held, ${ruled.reason}`);
    }
    await sleep(PACE_MS);
  }

  ledger.updatedAt = new Date().toISOString();
  await fs.writeFile(compositesPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  console.log(`[composites] Approved: ${approved} · held: ${held}`);
  if(held) console.log('[composites] A held proposal stays proposed; nothing was approved unmeasured.');
}

if(require.main === module){
  main().catch(error => { console.error(`[composites] ${error.message}`); process.exit(1); });
}

module.exports = { main };
