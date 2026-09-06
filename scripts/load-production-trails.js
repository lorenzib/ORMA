'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { applyVerifiedTrailOverrides } = require('./verified-trail-overrides');
const { applyTrailImageOverrides } = require('./trail-image-overrides');
const { applyRouteNumberEvidence } = require('./route-number-evidence');

const DEFAULT_FILES = [
  'trails-data.js',
  'osm-trails-data.js',
  'osm-trails-savoy-data.js',
  'trail-audits.js',
  'regions-config.js',
];

function loadProductionTrails(root, files = DEFAULT_FILES){
  const source = files
    .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n;\n');
  let trails = null;
  const sandbox = {
    window: {},
    console,
    __capture(value){ trails = value; },
  };
  vm.runInNewContext(
    `${source}\n;window.DoloPawsRegions.assign(trails); __capture(trails);`,
    sandbox,
    { filename: 'production-trail-data-bundle.js' }
  );
  if(!Array.isArray(trails) || !trails.length){
    throw new Error('Production trail sources did not produce a non-empty trail array.');
  }
  const overridePath = path.join(root, 'data', 'verified-trail-overrides.json');
  const overrides = fs.existsSync(overridePath) ? JSON.parse(fs.readFileSync(overridePath, 'utf8')) : { trails:[] };
  const imageOverridePath=path.join(root,'data','trail-image-overrides.json');
  const imageOverrides=fs.existsSync(imageOverridePath)?JSON.parse(fs.readFileSync(imageOverridePath,'utf8')):{trails:[]};
  // The verification campaign ranks candidates from these objects, and the gate
  // it ranks them towards asks for supported authoritative route guidance. Until
  // now this status was derived only when the site data was generated, so the
  // campaign could not see it: 3 of 165 trails carried the field, and the queue
  // filled with routes that cannot produce route guidance at all.
  return applyRouteNumberEvidence(
    applyTrailImageOverrides(applyVerifiedTrailOverrides(trails, overrides), imageOverrides),
    root,
  );
}

module.exports = {
  DEFAULT_FILES,
  loadProductionTrails,
};
