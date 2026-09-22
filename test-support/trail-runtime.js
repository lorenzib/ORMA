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

/**
 * The named modules in the order the bundle runs them, refusing any it does
 * not carry. The page-level counterpart lives in test-support/page-runtime.js;
 * the trail page loads one bundle, so its order is here rather than in markup.
 */
function bundleModules(names){
  const missing = names.filter(name => sourceIndex(name) === -1);
  if(missing.length){
    throw new Error(
      `The trail bundle does not carry ${missing.join(', ')}. Either it was `
      + 'dropped from SOURCES, in which case this test stands in for a program '
      + 'that no longer exists, or the name is wrong.'
    );
  }
  return SOURCES.filter(file => names.includes(file));
}

/** Hand each module's source to whatever a test runs it with, in that order. */
function evaluateBundled(evaluate, names){
  const files = bundleModules(names);
  for(const file of files){
    evaluate(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), file);
  }
  return files;
}

module.exports = {
  expectBundled, expectBundledBefore, expectTrailBundleLoaded,
  bundleModules, evaluateBundled,
};
