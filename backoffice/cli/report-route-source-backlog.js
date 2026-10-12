#!/usr/bin/env node
'use strict';

/**
 * report-route-source-backlog -- which trails cannot be verified yet, and why.
 *
 *   npm run backoffice:route-source-backlog
 *   npm run backoffice:route-source-backlog -- --region dolomites --limit 20
 *   npm run backoffice:route-source-backlog -- --ready
 *
 * Reads the catalogue only. No Firestore, no model calls, nothing is written.
 *
 * The four route claims are unwaivable, so a trail whose only source is the OSM
 * relation its line came from can never be verified however long it is
 * researched -- the agent declines to invent directions it cannot cite, and the
 * evidence policy rejects the trail at the end of the ladder. That is a sourcing
 * job, not a research job, and this is its worklist: what to go and find, with
 * the relation to start from.
 */

const path = require('path');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { routeSourceReady } = require('../workflows/run-trail-specialist');

function parseArgs(argv){
  const out = { region:null, province:null, limit:40, ready:false, json:false };
  for(let i = 0; i < argv.length; i += 1){
    const arg = argv[i];
    if(arg === '--region'){ out.region = argv[i += 1]; continue; }
    if(arg === '--province'){ out.province = argv[i += 1]; continue; }
    if(arg === '--limit'){ out.limit = Number.parseInt(argv[i += 1], 10) || 40; continue; }
    if(arg === '--ready'){ out.ready = true; continue; }
    if(arg === '--json'){ out.json = true; continue; }
  }
  return out;
}

/** The relation a sourcer starts from, and what the catalogue already believes. */
function lead(trail){
  const relation = (trail.sourceLinks || []).map(link => link?.url)
    .concat(trail.waymarkedtrails).find(url => /waymarkedtrails/i.test(String(url || ''))) || null;
  return {
    id: trail.id, name: trail.name || trail.id,
    where: [trail.valley, trail.area, trail.province].filter(Boolean).join(' · '),
    routeNumberStatus: trail.routeNumberStatus || null,
    routeReference: trail.routeReference || null,
    recordedStart: trail.startPoint?.label || trail.startPoint?.name || null,
    relation,
  };
}

function main(options = {}){
  const args = parseArgs(options.argv || process.argv.slice(2));
  const trails = loadProductionTrails(options.root || path.resolve(__dirname, '../..'));
  const scoped = trails.filter(trail =>
    (!args.region || String(trail.region) === args.region)
    && (!args.province || String(trail.province) === args.province));
  const ready = scoped.filter(routeSourceReady);
  const waiting = scoped.filter(trail => !routeSourceReady(trail));
  const shown = (args.ready ? ready : waiting).slice(0, args.limit);

  if(args.json){
    console.log(JSON.stringify({ total: scoped.length, ready: ready.length,
      awaitingRouteSource: waiting.length, items: shown.map(lead) }, null, 2));
    return { ready: ready.length, waiting: waiting.length };
  }

  console.log(`[route-source] ${scoped.length} trail(s) · ${ready.length} can be verified now · ${waiting.length} awaiting an official route source.`);
  console.log('[route-source] An OSM relation is not a route authority: it records that a path exists, not how to walk it.');
  console.log('');
  console.log(args.ready
    ? `[route-source] Ready to verify (${shown.length} of ${ready.length}):`
    : `[route-source] To source (${shown.length} of ${waiting.length}), newest status first:`);
  const byStatus = new Map();
  for(const trail of shown){
    const entry = lead(trail);
    const key = entry.routeNumberStatus || '(no status)';
    if(!byStatus.has(key)) byStatus.set(key, []);
    byStatus.get(key).push(entry);
  }
  for(const [status, entries] of [...byStatus.entries()].sort((a, b) => b[1].length - a[1].length)){
    console.log(`[route-source]   ${status} — ${entries.length}`);
    for(const entry of entries){
      console.log(`[route-source]     ${entry.name} (${entry.id})${entry.where ? ` · ${entry.where}` : ''}`);
      if(entry.routeReference) console.log(`[route-source]       route ${entry.routeReference}`);
      if(entry.recordedStart) console.log(`[route-source]       recorded start: ${entry.recordedStart}`);
      if(entry.relation) console.log(`[route-source]       relation: ${entry.relation}`);
    }
  }
  console.log('');
  console.log('[route-source] What counts: a page published by the comune, park, forestry service,');
  console.log('[route-source] tourism board, alpine club or operator that names the start and the');
  console.log('[route-source] route a walker follows. Add it to the trail’s sourceLinks.');
  console.log('[route-source] Nothing was changed.');
  return { ready: ready.length, waiting: waiting.length };
}

if(require.main === module) main();

module.exports = { parseArgs, lead, main };
