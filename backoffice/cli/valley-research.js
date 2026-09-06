#!/usr/bin/env node
'use strict';

/**
 * valley-research — organise trail verification by valley instead of by trail.
 *
 *   worksheet            write one worksheet per valley, biggest first
 *   check <file>         validate a filled worksheet and show what it would record
 *   apply <file>         record it, for real, dated today
 *
 * `apply` only ever creates new audit entries. An entry written by hand is
 * never rewritten: it is reported and left alone.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  REVIEW_CATEGORIES, groupByValley, worksheetFor, validateWorksheet, planApply,
} = require('../workflows/valley-research');

const root = path.resolve(__dirname, '../..');
const worksheetDirectory = path.join(root, 'backoffice-data', 'valley-research');
const auditsFile = path.join(root, 'trail-audits.js');

function loadTrails() {
  const sources = ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js', 'trail-audits.js', 'regions-config.js'];
  const bundle = sources.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n');
  let loaded = null;
  vm.runInNewContext(`${bundle}\n;window.DoloPawsRegions.assign(trails);__capture(trails);`,
    { window: {}, console, __capture: value => { loaded = value; } });
  if (!Array.isArray(loaded) || !loaded.length) throw new Error('Could not load the trail catalogue.');
  return loaded;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function writeWorksheets(trails) {
  fs.mkdirSync(worksheetDirectory, { recursive: true });
  const groups = groupByValley(trails);
  groups.forEach(group => {
    const target = path.join(worksheetDirectory, `${group.slug}.json`);
    // Never clobber research someone has already started.
    if (fs.existsSync(target)) {
      console.log(`  kept    ${group.slug}.json (already started)`);
      return;
    }
    fs.writeFileSync(target, `${JSON.stringify(worksheetFor(group), null, 2)}\n`, 'utf8');
    console.log(`  wrote   ${group.slug}.json  ${String(group.trailCount).padStart(3)} trails`);
  });
  const total = groups.reduce((sum, group) => sum + group.trailCount, 0);
  console.log(`\n${total} unverified trails across ${groups.length} valleys.`);
  console.log(`Worksheets in backoffice-data/valley-research/. Fill in the sources, then:`);
  console.log(`  npm run backoffice:valley-research -- check backoffice-data/valley-research/<file>.json`);
}

function report(worksheet, trails) {
  const { plans, skipped } = planApply(worksheet, trails, today());
  console.log(`\n${worksheet.valley}`);
  if (plans.length) {
    console.log(`\nWould record a review for ${plans.length} trail(s):`);
    plans.slice(0, 12).forEach(plan => {
      const missing = plan.stillMissing.length ? `  (still needs ${plan.stillMissing.join(', ')})` : '  (complete)';
      console.log(`  ${plan.name.slice(0, 44).padEnd(46)} ${plan.categories.join(', ')}${missing}`);
    });
    if (plans.length > 12) console.log(`  … and ${plans.length - 12} more`);
  } else {
    console.log('\nNothing would be recorded.');
  }
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    const reasons = {};
    skipped.forEach(entry => { reasons[entry.reason] = (reasons[entry.reason] || 0) + 1; });
    Object.entries(reasons).forEach(([reason, count]) => console.log(`  ${String(count).padStart(3)}  ${reason}`));
  }
  return plans;
}

/** Single-quoted to match the file's own style; falls back when unsafe. */
function str(value) {
  const text = String(value);
  return /['\\\n]/.test(text) ? JSON.stringify(text) : `'${text}'`;
}

/** Render one audit entry in the style the file already uses. */
function renderEntry(plan) {
  const list = values => values.map(value => `'${value}'`).join(', ');
  const links = plan.sourceLinks.map(link => [
    '        {',
    `          label: ${str(link.label)},`,
    `          url: ${str(link.url)},`,
    `          categories: [${list(link.categories)}]`,
    '        }',
  ].join('\n')).join(',\n');
  return [
    `    '${plan.id}': {`,
    `      // Valley research: ${plan.reviewedAt}. Categories reviewed against the`,
    '      // sources recorded below; every other category stays unreviewed.',
    `      reviewedAt: '${plan.reviewedAt}',`,
    `      reviewedBy: ${str(plan.reviewedBy)},`,
    '      sourceLinks: [',
    links,
    '      ],',
    '      verified: {',
    `        categories: [${list(plan.verified.categories)}],`,
    `        sources: [${plan.verified.sources.map(str).join(', ')}],`,
    `        date: '${plan.verified.date}'`,
    '      }',
    '    },',
  ].join('\n');
}

function apply(worksheet, trails) {
  const plans = report(worksheet, trails);
  if (!plans.length) return 0;

  const file = fs.readFileSync(auditsFile, 'utf8');
  // Only create entries. A trail already present was written by hand, and
  // mechanical editing of hand-written safety copy is not worth the risk.
  const existing = plans.filter(plan => file.includes(`'${plan.id}':`));
  const fresh = plans.filter(plan => !file.includes(`'${plan.id}':`));
  if (existing.length) {
    console.log(`\n${existing.length} trail(s) already have an audit entry and were left untouched:`);
    existing.forEach(plan => console.log(`  ${plan.id}  ${plan.name}`));
  }
  if (!fresh.length) {
    console.log('\nNothing new to write.');
    return 0;
  }

  const anchor = '  const audits = {';
  if (!file.includes(anchor)) throw new Error('trail-audits.js does not have the expected shape; not writing.');
  const updated = file.replace(anchor, `${anchor}\n${fresh.map(renderEntry).join('\n')}`);

  // Refuse to leave the catalogue broken: the file must still parse and still
  // load every trail before it is committed to disk.
  const check = path.join(root, 'trail-audits.js');
  const backup = file;
  fs.writeFileSync(check, updated, 'utf8');
  try {
    loadTrails();
  } catch (error) {
    fs.writeFileSync(check, backup, 'utf8');
    throw new Error(`Wrote nothing: the result did not load (${error.message})`);
  }
  console.log(`\nRecorded ${fresh.length} trail review(s) in trail-audits.js, dated ${today()}.`);
  return fresh.length;
}

function main() {
  const [command, file] = process.argv.slice(2);
  const trails = loadTrails();

  if (!command || command === 'worksheet') {
    writeWorksheets(trails);
    return;
  }
  if (!file) {
    console.error(`Usage: valley-research ${command} <worksheet.json>`);
    process.exitCode = 1;
    return;
  }
  const worksheet = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const errors = validateWorksheet(worksheet);
  if (errors.length) {
    console.error(`\n${worksheet.valley || file} is not ready:\n`);
    errors.forEach(error => console.error(`  - ${error}`));
    console.error(`\nReview categories: ${REVIEW_CATEGORIES.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  if (command === 'check') {
    report(worksheet, trails);
    console.log('\nNothing was written. Re-run with "apply" to record it.');
    return;
  }
  if (command === 'apply') {
    apply(worksheet, trails);
    return;
  }
  console.error(`Unknown command "${command}". Use worksheet, check or apply.`);
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { renderEntry, loadTrails, str };
