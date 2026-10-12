#!/usr/bin/env node
'use strict';

/**
 * scout-route-sources -- find the official page for walks that have none.
 *
 *   npm run backoffice:scout-route-sources -- --region dolomites --limit 5
 *   npm run backoffice:scout-route-sources -- --region dolomites --limit 10 --apply
 *
 * Dry run by default: it still searches and still fetches, so the result is
 * real, but nothing is written without --apply.
 *
 * Nobody reviews the output. The agent must quote the page, this fetches that
 * page and checks the quote is in it, and only a find that passes is written.
 * A find that fails is reported with the rule that failed it and dropped, so
 * the next pass can try a different page rather than a person adjudicating it.
 */

const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { routeSourceReady } = require('../workflows/run-trail-specialist');
const { SOURCED_ROUTE_PAGES } = require('../../scripts/route-number-evidence');
const { scoutRouteSource, confirmProposal, mergeSourcedPages } = require('../workflows/scout-route-sources');

const FETCH_TIMEOUT_MS = 20000;

function parseArgs(argv){
  const out = { region:null, province:null, limit:5, apply:false, trail:null };
  for(let i = 0; i < argv.length; i += 1){
    const arg = argv[i];
    if(arg === '--region'){ out.region = argv[i += 1]; continue; }
    if(arg === '--province'){ out.province = argv[i += 1]; continue; }
    if(arg === '--trail'){ out.trail = argv[i += 1]; continue; }
    if(arg === '--limit'){ out.limit = Number.parseInt(argv[i += 1], 10) || 5; continue; }
    if(arg === '--apply'){ out.apply = true; continue; }
  }
  return out;
}

/** The page as it actually is now, which is what the quote is checked against. */
async function retrieve(url, fetchImpl = fetch){
  try{
    const response = await fetchImpl(url, { redirect:'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers:{ 'User-Agent':'ORMA-route-source-scout/1.0' } });
    if(!response.ok) return { ok:false, error:`HTTP ${response.status}` };
    return { ok:true, body: await response.text() };
  }catch(error){
    return { ok:false, error:String(error?.message || error).slice(0, 200) };
  }
}

/** Trails with no citable route source, in the scope asked for. */
function needsSource(trails, args){
  return trails.filter(trail => !routeSourceReady(trail)
    && (!args.trail || String(trail.id) === args.trail)
    && (!args.region || String(trail.region) === args.region)
    && (!args.province || String(trail.province) === args.province));
}

async function main(options = {}){
  const args = parseArgs(options.argv || process.argv.slice(2));
  const root = options.root || path.resolve(__dirname, '../..');
  // `root` is where a confirmed page is written; the catalogue is read from the
  // repository, or injected, so a test can write to a temporary directory
  // without needing the whole catalogue beside it.
  const trails = options.trails || loadProductionTrails(options.catalogueRoot || path.resolve(__dirname, '../..'));
  const waiting = needsSource(trails, args);
  const batch = waiting.slice(0, args.limit);

  console.log(`[scout] ${waiting.length} trail(s) need an official route page; scouting ${batch.length}.`);
  if(!batch.length){ console.log('[scout] Nothing to do.'); return { confirmed:[], dropped:[] }; }

  const confirmed = [], dropped = [];
  for(const trail of batch){
    try{
      const { proposal } = await scoutRouteSource(trail, options);
      const url = String(proposal?.url || '').trim();
      // Only fetch a page the proposal could still pass with. A rejection that
      // needs no network should not spend a request.
      const page = /^https:\/\//.test(url) && proposal?.found === true
        ? await retrieve(url, options.fetchImpl)
        : null;
      const verdict = confirmProposal(proposal, trail, page);
      if(verdict.confirmed){
        confirmed.push(verdict.source);
        console.log(`[scout]   FOUND    ${trail.id} · ${verdict.source.publisher} · ${verdict.source.url}`);
      }else{
        dropped.push({ trailId:trail.id, rule:verdict.rule, url:url || null });
        console.log(`[scout]   none     ${trail.id} · ${verdict.rule}${url ? ` · ${url}` : ''}`
          + (page && page.ok === false ? ` · ${page.error}` : ''));
      }
    }catch(error){
      dropped.push({ trailId:trail.id, rule:'scouting-failed', error:String(error.message || error).slice(0,300) });
      console.log(`[scout]   failed   ${trail.id} · ${String(error.message || error).slice(0,160)}`);
    }
  }

  console.log('');
  console.log(`[scout] ${confirmed.length} confirmed, ${dropped.length} not found or not provable.`);
  const byRule = dropped.reduce((tally, entry) => ({ ...tally, [entry.rule]:(tally[entry.rule] || 0) + 1 }), {});
  for(const [rule, count] of Object.entries(byRule)) console.log(`[scout]   ${count}x ${rule}`);

  if(!args.apply){
    console.log('[scout] Dry run. Nothing written. Re-run with --apply to record the confirmed pages.');
    return { confirmed, dropped };
  }
  if(!confirmed.length){
    console.log('[scout] Nothing confirmed, so nothing was written.');
    return { confirmed, dropped };
  }
  const file = path.join(root, SOURCED_ROUTE_PAGES);
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const merged = mergeSourcedPages(existing, confirmed, { at: options.at });
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`[scout] Wrote ${confirmed.length} confirmed page(s) to ${SOURCED_ROUTE_PAGES} (${Object.keys(merged.sources).length} total).`);
  console.log('[scout] Run `npm run generate:artifacts` and commit, or let the workflow do it.');
  return { confirmed, dropped };
}

if(require.main === module) main().catch(error => { console.error(`[scout] ${error.stack || error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, retrieve, needsSource, main };
