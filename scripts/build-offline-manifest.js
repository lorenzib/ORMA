#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
// The two hand-built pilots. Their revisions are typed here on purpose: the
// physical device-test gates name them, so moving one is a decision.
const configs = {
  'lago-carezza': { name:'Lago di Carezza Loop', height:1140, version:'2026.10.24-beta.23', verificationStatus:'source-verified' },
  'alpe-siusi': { name:'Alpe di Siusi Meadow Loop', height:720, version:'2026.10.24-beta.11', verificationStatus:'not-verified' },
};

// A generated package has no device test tied to it, so its revision moves on
// its own -- but only when a downloadable byte changes, by the same rule.
function nextGeneratedVersion(previous, now = new Date()){
  const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
  const beta = previous && String(previous.version || '').match(/-beta\.(\d+)$/);
  return `${date}-beta.${beta ? Number(beta[1]) + 1 : 1}`;
}

const VERIFICATION_STATUSES = Object.freeze(['source-verified', 'not-verified']);

function buildManifest(trailId, config){
  if(!VERIFICATION_STATUSES.includes(config.verificationStatus)){
    throw new Error(`${trailId} needs a verificationStatus: ${VERIFICATION_STATUSES.join(' or ')}`);
  }
  const packageDir = path.join(root, 'offline', 'packages', trailId);
  const graph = JSON.parse(fs.readFileSync(path.join(packageDir, 'footpath-network.json'), 'utf8'));
  const elevationProfile = JSON.parse(fs.readFileSync(path.join(packageDir, 'elevation-profile.json'), 'utf8'));
  if(elevationProfile.schemaVersion !== 1 || elevationProfile.trailId !== trailId ||
     !Array.isArray(elevationProfile.points) || elevationProfile.points.length < 2){
    throw new Error(`Invalid elevation profile for ${trailId}`);
  }
  const roles = [
    ['shell', 'Offline trail page', '/offline/trail.html'],
    ['style', 'Offline trail styles', '/offline/offline.css'],
    ['app', 'Offline trail application', '/offline/offline-app.js'],
    ['gps-policy', 'GPS safety policy', '/hike-gps-policy.js'],
    ['route-rejoin', 'Offline route rejoin guidance', '/route-rejoin.js'],
    ['hike-distance', 'Direction-neutral walked distance', '/hike-distance.js'],
    ['footpath-router', 'Offline mapped footpath router', '/footpath-router.js'],
    ['elevation-engine', 'Offline route elevation engine', '/offline-elevation.js'],
    ['session', 'Durable hike session', '/hike-session.js'],
    ['completion', 'Durable hike completion', '/hike-completions.js'],
    ['outcome', 'Private post-hike outcome', '/post-hike-outcomes.js'],
    ['map', `${config.name} OSM offline map`, 'map.svg'],
    ['route', `${config.name} route`, 'route.geojson'],
    ['footpath-network', `${config.name} routable footpath corridor`, 'footpath-network.json'],
    ['elevation-profile', `${config.name} stored route elevation profile`, 'elevation-profile.json'],
    ['safety', `${config.name} safety information`, 'safety.json'],
  ];

  function fileFor(url){
    return url.startsWith('/') ? path.join(root, url) : path.join(packageDir, url);
  }

  const resources = roles.map(([role, label, url]) => {
    const data = fs.readFileSync(fileFor(url));
    return {
      role,
      required:true,
      label,
      url,
      bytes:data.byteLength,
      sha256:crypto.createHash('sha256').update(data).digest('hex'),
    };
  });
  const unknown = {
    sourceState:'unknown', sourceLabel:'Evidence unknown', freshnessState:'unknown',
    freshnessLabel:'Freshness unknown', observedAt:null, observedLabel:'date unknown',
  };
  const mapped = {
    sourceState:'mapped', sourceLabel:'Mapped data', freshnessState:'unknown',
    freshnessLabel:'Freshness unknown', observedAt:null, observedLabel:'date unknown',
  };
  // A package revision labels what people download. Anything that does not
  // change a downloadable byte must not move it: the physical device-test gates
  // are tied to the revision, so a cosmetic bump silently invalidates QA
  // evidence that is still perfectly valid.
  const previous = (() => {
    try{ return JSON.parse(fs.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8')); }
    catch(error){ return null; }
  })();

  function sameBytes(before, after){
    if(!before || !Array.isArray(before.resources)) return false;
    if(before.resources.length !== after.length) return false;
    const key = list => list
      .map(item => `${item.url}:${item.bytes}:${item.sha256 || item.hash || ''}`)
      .sort()
      .join('|');
    return key(before.resources) === key(after);
  }

  const unchanged = sameBytes(previous, resources);
  if(!config.version) config = { ...config, version:nextGeneratedVersion(previous) };
  if(unchanged){
    console.error(`[keep] ${trailId} packaged bytes are unchanged; keeping revision ${previous.version}.`);
  }else if(previous && previous.version === config.version){
    console.error(
      `[error] ${trailId} packaged bytes changed but the revision is still ${config.version}.\n` +
      '        Bump the version in scripts/build-offline-manifest.js so the download people\n' +
      '        already have is not silently replaced under the same label.');
    throw new Error(`${trailId} packaged bytes changed under an unchanged revision`);
  }

  const manifest = {
    schemaVersion:1,
    trailId,
    name:config.name,
    // Follows the bytes, not the calendar.
    version:unchanged ? previous.version : config.version,
    // The build did not happen if nothing was rebuilt, so the stamp stands.
    generatedAt:unchanged && previous.generatedAt ? previous.generatedAt : new Date().toISOString(),
    scoringVersion:require('../scoring/recommendation-v1.js').VERSION,
    verificationStatus:config.verificationStatus,
    packageBytes:resources.reduce((total, item) => total + item.bytes, 0),
    packageBudgetBytes:5242880,
    bounds:graph.bounds,
    image:{ width:1200, height:config.height },
    mapCorridor:{ strategy:'fixed-bounds-svg-v1', scaleLevels:[1], width:1200, height:config.height },
    routingGraph:{
      strategy:'osm-walking-graph-v1',
      nodeCount:graph.nodes.length,
      edgeCount:graph.edges.length,
      trailNodeCount:graph.trailNodes.length,
      maxRejoinRouteM:1500,
    },
    elevationProfile:{
      strategy:'route-profile-v1',
      pointCount:elevationProfile.points.length,
      distanceKm:elevationProfile.distanceKm,
      ascentM:elevationProfile.ascentM,
      source:elevationProfile.source,
      demPackaged:false,
    },
    evidence:{
      version:'1.0.0', tier:'mapped', tierLabel:'Mapped route',
      categories:{
        route:{ ...mapped }, water:{ ...mapped }, heat:{ ...unknown }, exposure:{ ...unknown },
        livestock:{ ...unknown }, surfaceHazards:{ ...unknown }, access:{ ...unknown },
      },
    },
    attribution:'Route data © ORMA; © OpenStreetMap contributors where applicable',
    licenceUrl:'https://www.openstreetmap.org/copyright',
    resources,
  };
  fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

module.exports = { buildManifest, nextGeneratedVersion, PILOT_CONFIGS:configs, VERIFICATION_STATUSES };

if(require.main === module){
  const trailId = process.argv[2];
  const config = configs[trailId];
  if(!config) throw new Error(`Unsupported offline package: ${trailId || '(missing)'}`);
  try{
    const manifest = buildManifest(trailId, config);
    console.log(JSON.stringify({ trailId, resources:manifest.resources.length, packageBytes:manifest.packageBytes }, null, 2));
  }catch(error){
    console.error(error.message);
    process.exit(1);
  }
}
