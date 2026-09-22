'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/**
 * What a page actually loads, for tests that build a runtime to stand in for
 * one.
 *
 * Four suites in this repository were asserting on fallbacks rather than on
 * what ships, each for the same reason: the test hand-wrote the list of
 * modules to evaluate, the page's list moved on, and nothing connected the
 * two. A module the page loads and the test does not is invisible -- the code
 * under test falls back, renders something plausible or nothing at all, and
 * the assertions pass. One of them passed while rendering an empty cell.
 *
 * So the page is the source of truth here, for which modules exist and for the
 * order they run in. A test names what it depends on; if the page stops
 * loading it, or loads it later than a module that reads it, the test says so
 * instead of quietly testing a different program.
 *
 * test-support/trail-runtime.js does the same job for the trail bundle, whose
 * order lives in the build script rather than in markup.
 */

const SCRIPT_SRC = /<script\b[^>]*\bsrc="([^"]+)"/g;

/** Local script paths a page loads, in document order, without cache keys. */
function pageScripts(page){
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const scripts = [];
  for(const [, src] of html.matchAll(SCRIPT_SRC)){
    if(/^(?:[a-z]+:)?\/\//i.test(src)) continue;
    const file = src.split('?')[0].replace(/^\.\//, '');
    if(file) scripts.push(file);
  }
  return scripts;
}

/**
 * The named modules in the order the page runs them, refusing any the page
 * does not load. Order matters: a module that reads another has to follow it,
 * and a test that evaluates them in its own order is testing its own order.
 */
function modulesFrom(page, names){
  const scripts = pageScripts(page);
  const missing = names.filter(name => !scripts.includes(name));
  if(missing.length){
    throw new Error(
      `${page} does not load ${missing.join(', ')}. Either the page stopped `
      + 'loading it, in which case this test is standing in for a program that '
      + 'no longer exists, or the name is wrong.'
    );
  }
  return scripts.filter(script => names.includes(script));
}

/**
 * A module that reads another has to run after it. Stating that in a test is
 * what makes a reordered page fail loudly rather than work by accident --
 * compare.html loaded the view before the vocabulary it reads for a week, and
 * only kept working because the read happens at call time.
 */
function expectLoadedBefore(page, first, second){
  const scripts = pageScripts(page);
  expect(scripts).toContain(first);
  expect(scripts).toContain(second);
  expect(scripts.indexOf(first)).toBeLessThan(scripts.indexOf(second));
}

/** Read one of the repository's own sources. */
function sourceOf(file){
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/**
 * Hand each module's source to whatever a test is using to run it -- a vm
 * context, a jsdom window, a bare eval -- in the page's order.
 */
function evaluateInto(evaluate, page, names){
  const files = modulesFrom(page, names);
  for(const file of files) evaluate(sourceOf(file), file);
  return files;
}

/** The same, for modules a test loads through node rather than evaluating. */
function requireAll(page, names){
  const files = modulesFrom(page, names);
  return files.map(file => require(path.join(ROOT, file)));
}

module.exports = { pageScripts, modulesFrom, expectLoadedBefore, sourceOf, evaluateInto, requireAll };
