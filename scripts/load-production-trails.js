'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  return trails;
}

module.exports = {
  DEFAULT_FILES,
  loadProductionTrails,
};
