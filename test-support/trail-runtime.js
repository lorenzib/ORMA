'use strict';

const fs = require('fs');
const path = require('path');
const { SOURCES } = require('../scripts/build-trail-page-bundle.js');

function sourceIndex(file){
  return SOURCES.indexOf(file);
}

function expectBundled(file){
  expect(sourceIndex(file)).toBeGreaterThan(-1);
}

function expectBundledBefore(first, second){
  expectBundled(first);
  expectBundled(second);
  expect(sourceIndex(first)).toBeLessThan(sourceIndex(second));
}

function expectTrailBundleLoaded(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'trail.html'), 'utf8');
  expect(html).toMatch(/src="trail-app\.bundle\.js\?v=\d{8}-\d+" defer/);
}

module.exports = { expectBundled, expectBundledBefore, expectTrailBundleLoaded };
