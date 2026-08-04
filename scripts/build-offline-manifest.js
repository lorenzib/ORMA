#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const trailId = process.argv[2];
const configs = {
  'lago-carezza': { name:'Lago di Carezza Loop', height:1140, version:'2026.08.04-beta.14' },
  'alpe-siusi': { name:'Alpe di Siusi Meadow Loop', height:720, version:'2026.08.04-beta.1' },
};
const config = configs[trailId];
if(!config) throw new Error(`Unsupported offline package: ${trailId || '(missing)'}`);

const packageDir = path.join(root, 'offline', 'packages', trailId);
const graph = JSON.parse(fs.readFileSync(path.join(packageDir, 'footpath-network.json'), 'utf8'));
const roles = [
  ['shell', 'Offline trail page', '/offline/trail.html'],
  ['style', 'Offline trail styles', '/offline/offline.css'],
  ['app', 'Offline trail application', '/offline/offline-app.js'],
  ['gps-policy', 'GPS safety policy', '/hike-gps-policy.js'],
  ['route-rejoin', 'Offline route rejoin guidance', '/route-rejoin.js'],
  ['footpath-router', 'Offline mapped footpath router', '/footpath-router.js'],
  ['session', 'Durable hike session', '/hike-session.js'],
  ['completion', 'Durable hike completion', '/hike-completions.js'],
  ['outcome', 'Private post-hike outcome', '/post-hike-outcomes.js'],
  ['map', `${config.name} OSM offline map`, 'map.svg'],
  ['route', `${config.name} route`, 'route.geojson'],
  ['footpath-network', `${config.name} routable footpath corridor`, 'footpath-network.json'],
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
const manifest = {
  schemaVersion:1,
  trailId,
  name:config.name,
  version:config.version,
  generatedAt:new Date().toISOString(),
  scoringVersion:require('../scoring/recommendation-v1.js').VERSION,
  verificationStatus:'field-review-required',
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
  evidence:{
    version:'1.0.0', tier:'mapped', tierLabel:'Mapped route',
    categories:{
      route:{ ...mapped }, water:{ ...mapped }, heat:{ ...unknown }, exposure:{ ...unknown },
      livestock:{ ...unknown }, surfaceHazards:{ ...unknown }, access:{ ...unknown },
    },
  },
  attribution:'Route data © DoloPaws; © OpenStreetMap contributors where applicable',
  licenceUrl:'https://www.openstreetmap.org/copyright',
  resources,
};
fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ trailId, resources:resources.length, packageBytes:manifest.packageBytes }, null, 2));
