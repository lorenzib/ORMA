#!/usr/bin/env node
'use strict';

/**
 * build-pages-site.js, assemble the directory GitHub Pages publishes.
 *
 * The repository has a .nojekyll file, so Pages serves it verbatim and never
 * runs Jekyll. That means the `exclude:` list in _config.yml was never
 * honoured: backoffice-data/, the desk pages, the Node test suites and
 * package.json were all fetchable on www.app-orma.com even though the config
 * said otherwise. Two separate commits "excluded" them and changed nothing.
 *
 * This script makes that list real. It copies the repository into an output
 * directory, skipping everything `exclude:` names, and the deploy workflow
 * publishes that directory instead of the repository root. _config.yml stays
 * the single source of truth so the two cannot drift apart again.
 *
 * Usage: node scripts/build-pages-site.js [outDir]   (default: _site)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_site');

// Never publishable, and never worth walking into.
const ALWAYS_SKIP = new Set(['.git', 'node_modules', '_site', '.github', 'dist']);

// Dotfiles are skipped by default (Jekyll does the same); these must survive.
const ALWAYS_KEEP = new Set(['.nojekyll', 'CNAME']);

function readConfig() {
  const file = path.join(ROOT, '_config.yml');
  if (!fs.existsSync(file)) return { exclude: [], include: [] };
  const parsed = yaml.load(fs.readFileSync(file, 'utf8')) || {};
  return {
    exclude: Array.isArray(parsed.exclude) ? parsed.exclude.filter(Boolean) : [],
    include: Array.isArray(parsed.include) ? parsed.include.filter(Boolean) : [],
  };
}

/**
 * Jekyll-style pattern matching, limited to what the config actually uses:
 * a bare name (file or whole directory) and a `*` glob.
 */
function patternToTest(pattern) {
  const clean = String(pattern).replace(/^\.\//, '').replace(/\/$/, '');
  if (clean.includes('*')) {
    const source = '^' + clean
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*') + '$';
    const regex = new RegExp(source);
    // A glob matches on the basename as well, so "*.test.js" catches nested
    // suites like backoffice/publication-gate.test.js.
    return relative => regex.test(relative) || regex.test(path.basename(relative));
  }
  // A bare name matches the entry itself and everything beneath it.
  return relative => relative === clean || relative.startsWith(clean + '/');
}

function buildMatchers(patterns) {
  const tests = patterns.map(patternToTest);
  return relative => tests.some(test => test(relative));
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function walk(dir, relativeDir, isExcluded, isIncluded, stats) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

    if (ALWAYS_SKIP.has(relative)) { stats.skipped.push(relative); continue; }

    const keep = ALWAYS_KEEP.has(relative) || isIncluded(relative);
    if (!keep) {
      if (entry.name.startsWith('.')) { stats.skipped.push(relative); continue; }
      if (isExcluded(relative)) { stats.excluded.push(relative); continue; }
    }

    const from = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(from, relative, isExcluded, isIncluded, stats);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      copyFile(from, path.join(OUT, relative));
      stats.copied += 1;
    }
  }
}

function build() {
  const { exclude, include } = readConfig();
  const isExcluded = buildMatchers(exclude);
  const isIncluded = buildMatchers(include);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const stats = { copied: 0, excluded: [], skipped: [] };
  walk(ROOT, '', isExcluded, isIncluded, stats);

  // Keep Pages serving the artifact verbatim.
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  return { ...stats, exclude };
}

const MANIFEST = path.join(ROOT, 'pages-public-manifest.json');

/** Everything the built site exposes at its top level. */
function topLevelOf(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return {
    directories: entries.filter(e => e.isDirectory()).map(e => e.name).sort(),
    files: entries.filter(e => !e.isDirectory()).map(e => e.name).sort(),
  };
}

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function writeManifest(site) {
  const listed = topLevelOf(site);
  fs.writeFileSync(MANIFEST, JSON.stringify({
    _comment: [
      'Every top-level entry the public site is allowed to publish.',
      'pages-site-build.test.js compares the built _site against this list in',
      'both directions, so adding a page here is a deliberate, reviewable step',
      'and dropping one by accident fails the build.',
      'Regenerate with: node scripts/build-pages-site.js --write-manifest',
    ],
    ...listed,
  }, null, 2) + '\n');
  return listed;
}

module.exports = { build, readConfig, patternToTest, buildMatchers, topLevelOf, readManifest, OUT, MANIFEST };

if (require.main === module) {
  const writeMode = process.argv.includes('--write-manifest');
  const stats = build();
  console.log(`Built ${path.relative(ROOT, OUT) || '_site'}, ${stats.copied} files published.`);
  console.log(`Excluded ${stats.excluded.length} top-level entries via _config.yml.`);
  if (writeMode) {
    const listed = writeManifest(OUT);
    console.log(`Wrote pages-public-manifest.json, ${listed.directories.length} directories, ${listed.files.length} files.`);
  }
}
