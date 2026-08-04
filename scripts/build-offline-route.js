#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const trailId = process.argv[2];
if(!trailId || !/^[a-z0-9-]+$/.test(trailId)){
  throw new Error('Usage: node scripts/build-offline-route.js <trail-id>');
}

const source = fs.readFileSync(path.join(root, 'trails-data.js'), 'utf8');
const trails = vm.runInNewContext(`${source}\ntrails;`, {});
const trail = trails.find(item => item.id === trailId);
if(!trail || !Array.isArray(trail.path) || trail.path.length < 2){
  throw new Error(`No route geometry exists for ${trailId}.`);
}

const duration = String(trail.hours || '').split(/[–-]/)[0];
const geojson = {
  type:'FeatureCollection',
  features:[{
    type:'Feature',
    id:trail.id,
    properties:{
      name:trail.name,
      distanceKm:trail.distance,
      ascentM:trail.elevation,
      durationHours:Number(duration) || null,
      source:'DoloPaws repository route geometry',
      verificationStatus:'field-review-required',
    },
    geometry:{
      type:'LineString',
      coordinates:trail.path.map(([lat, lng]) => [lng, lat]),
    },
  }],
};

const output = path.join(root, 'offline', 'packages', trailId, 'route.geojson');
fs.mkdirSync(path.dirname(output), { recursive:true });
fs.writeFileSync(output, `${JSON.stringify(geojson, null, 2)}\n`);
console.log(`Rendered ${output}`);
