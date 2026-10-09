#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { buildHazardArtifacts } = require('../workflows/dynamic-hazards');
const { CONNECTORS, inSeason } = require('../workflows/hazard-sources');

const SOURCES = CONNECTORS;

async function readJson(file, fallback){ try{return JSON.parse(await fs.readFile(file, 'utf8'));}catch(error){if(error.code === 'ENOENT')return fallback;throw error;} }
async function writeJson(file, value){ await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

async function fetchSource(source, fetchImpl, options = {}){
  const at = options.at || new Date().toISOString();
  const urls = typeof source.urls === 'function' ? source.urls(at) : [source.url];
  const describe = extra => ({ key: source.key, label: source.label, url: urls[0], kind: source.kind || 'weather-feed', ...extra });

  // Out of season is not a failure. An avalanche bulletin does not exist in
  // October, and reporting that every three hours would teach an operator to
  // ignore source failures -- the one signal here that must not become noise.
  // It is also NOT a complete snapshot: a source that published nothing has not
  // told us the warnings it carried last winter are over.
  if(!inSeason(source.season, at)){
    return { result: describe({ ok: true, completeSnapshot: false, alertsRead: 0,
      outOfSeason: `${source.label} publishes between ${source.season.from} and ${source.season.to}; nothing was read and nothing was removed.` }),
      observations: [] };
  }

  const attempts = [];
  for(const url of urls){
    try{
      const response = await fetchImpl(url, { headers: { 'User-Agent': 'ORMA-hazard-watch/1.0' } });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      // 206 is `ok`, and it means we were handed part of the document.
      if(response.status === 206) throw new Error('HTTP 206: the source returned only part of the document');
      const body = await response.text();
      const observations = (source.parse || (() => []))(body, source);
      // A source that answered but did not hand over a whole document may still
      // ADD the warnings it carried -- those are real. What it may not do is
      // remove the ones it failed to mention, because it may have been cut off.
      const completeSnapshot = (source.complete || (() => false))(body);
      return { result: describe({ url, ok: true, completeSnapshot, alertsRead: observations.length,
        ...(completeSnapshot ? {} : { partialSnapshot: 'The document did not close, so it may be truncated; warnings absent from it were not removed.' }) }),
        observations };
    }catch(error){
      attempts.push(`${url}: ${error.message}`);
    }
  }
  // Every candidate failed. A dated bulletin legitimately has no edition yet in
  // the early hours, which is why yesterday's is tried too; if both are gone the
  // source is unavailable and the last known warning is retained.
  return { result: describe({ ok: false, alertsRead: 0, error: attempts.join(' · ') }), observations: [] };
}

async function runHazardWatch(options = {}){
  const root = options.root || path.resolve(__dirname, '..', '..');
  const at = options.at || new Date().toISOString();
  const fetchImpl = options.fetchImpl || fetch;
  const runs = await Promise.all((options.sources || SOURCES).map(source => fetchSource(source, fetchImpl, { at })));
  const previous = options.store
    ? (await options.store.getArtifact('dynamic-hazards') || await readJson(path.join(root, 'data', 'dynamic-hazards.json'), { hazards: [] }))
    : await readJson(path.join(root, 'data', 'dynamic-hazards.json'), { hazards: [] });
  const artifacts = buildHazardArtifacts(previous, runs.flatMap(run => run.observations), runs.map(run => run.result), loadProductionTrails(root), { at });
  if(options.store){
    const protectedData={...artifacts.publicData,publicMutationAllowed:false};const protectedQueue={...artifacts.reviewQueue,publicMutationAllowed:false};const status={...artifacts.status,status:'healthy',workflowRunUrl:options.workflowRunUrl||null,runId:options.runId||null,publicMutationAllowed:false};
    await Promise.all([options.store.setArtifact('dynamic-hazards',protectedData,{status:'protected-current'}),options.store.setArtifact('hazard-review-queue',protectedQueue,{status:'awaiting-human'}),options.store.setArtifact('hazard-watch-status',status,{status:'healthy',runId:options.runId||null})]);
    return {...artifacts,publicData:protectedData,reviewQueue:protectedQueue,status};
  }else await Promise.all([
      writeJson(path.join(root, 'data', 'dynamic-hazards.json'), artifacts.publicData),
      writeJson(path.join(root, 'backoffice-data', 'hazard-review-queue.json'), artifacts.reviewQueue),
      writeJson(path.join(root, 'backoffice-data', 'hazard-watch-status.json'), artifacts.status),
    ]);
  return artifacts;
}

async function main(){
  const artifacts = await runHazardWatch();
  console.log(`[hazard-watch] ${artifacts.status.summary.active} active warnings; ${artifacts.status.summary.awaitingRemovalReview} awaiting removal review; ${artifacts.status.summary.sourceFailures} source failures.`);
  console.log('[hazard-watch] New authoritative warnings and source-confirmed removals are reflected in protected data; outages retain the last known warning.');
}

if(require.main === module) main().catch(error => { console.error(`[hazard-watch] ${error.message}`); process.exitCode = 1; });

module.exports = { SOURCES, fetchSource, runHazardWatch };
