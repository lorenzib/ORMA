#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { loadProductionTrails } = require('../../scripts/load-production-trails');
const { parseAtomFeed, buildHazardArtifacts, feedIsComplete } = require('../workflows/dynamic-hazards');

const SOURCES = [
  { key: 'meteoalarm-italy', label: 'MeteoAlarm Italy', url: 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-italy' },
  { key: 'meteoalarm-france', label: 'MeteoAlarm France', url: 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-france' },
];

async function readJson(file, fallback){ try{return JSON.parse(await fs.readFile(file, 'utf8'));}catch(error){if(error.code === 'ENOENT')return fallback;throw error;} }
async function writeJson(file, value){ await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

async function fetchSource(source, fetchImpl){
  try{
    const response = await fetchImpl(source.url, { headers: { 'User-Agent': 'ORMA-hazard-watch/1.0' } });
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    // 206 is `ok`, and it means we were handed part of the document. Removing
    // every warning a partial body failed to mention is exactly the mistake
    // this guards against.
    if(response.status === 206) throw new Error('HTTP 206: the source returned only part of the feed');
    const body = await response.text();
    const observations = parseAtomFeed(body, source);
    // A source that answered but did not hand over a whole feed may still ADD
    // the warnings it carried -- those are real. What it may not do is remove
    // the ones it failed to mention, because it may simply have been cut off.
    const completeSnapshot = feedIsComplete(body);
    return { result: { key: source.key, label: source.label, url: source.url, ok: true,
      completeSnapshot, alertsRead: observations.length,
      ...(completeSnapshot ? {} : { partialSnapshot: 'The feed did not close, so it may be truncated; warnings absent from it were not removed.' }) },
      observations };
  }catch(error){
    return { result: { key: source.key, label: source.label, url: source.url, ok: false, alertsRead: 0, error: error.message }, observations: [] };
  }
}

async function runHazardWatch(options = {}){
  const root = options.root || path.resolve(__dirname, '..', '..');
  const at = options.at || new Date().toISOString();
  const fetchImpl = options.fetchImpl || fetch;
  const runs = await Promise.all((options.sources || SOURCES).map(source => fetchSource(source, fetchImpl)));
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
