#!/usr/bin/env node
'use strict';

// The winter share: how many ORMA walks are a good pick all winter, and whether
// new walks are adding to it. ORMA was a summer catalogue: on 20 November 2026
// only 92 of 553 walks were good in December, January and February, so in
// winter the app mostly said "not now". Scouting keeps a share of every month's
// new walks for winter (backoffice/OPERATING_STANDARD.md, "A share of new walks
// is good in winter"); this script measures it.
//
// Good all winter means in season, and not hidden, in each of December,
// January and February, by the same rule the site uses
// (trail-season-words.js: bestMonths, outOfSeason, hiddenThisMonth). A walk
// with no season record is not counted as good: nothing says it is.
//
//   npm run report:winter-mix                      the share, by region, and
//                                                  for walks added in 30 days
//   npm run report:winter-mix -- --since 2026-11-01   (or a git ref)
//   npm run report:winter-mix -- --check           exits 1 below the quota
//   npm run report:winter-mix -- --json
//   npm run report:winter-mix -- --candidate 750   would a walk topping out at
//                                                  750 m count? (--months 4,5,6
//                                                  for a board's own months)

const path = require('path');
const { execFileSync } = require('child_process');
const words = require('../trail-season-words');
const { snowEstimate } = require('./trail-seasons');

const WINTER_MONTHS = [12, 1, 2];
// At least this share of the walks added in a period is good all winter.
const WINTER_QUOTA = 0.3;
const DEFAULT_SINCE_DAYS = 30;

function goodAllWinter(season){
  if(!season || !words.bestMonths(season)) return false;
  return WINTER_MONTHS.every(month => !words.outOfSeason(season, month) && !words.hiddenThisMonth(season, month));
}

// The season a candidate would get before it is built: its board's months when
// the board publishes them, else the snow estimate from its high point. Lifts,
// roads and ski runs are not known yet, so this can only say "would count if
// nothing else shuts it".
function candidateSeason(highPoint, boardMonths){
  const season = { highPoint: Math.round(Number(highPoint)) };
  if(boardMonths && boardMonths.length) season.recommended = { months: boardMonths.slice().sort((a, b) => a - b) };
  else season.snow = snowEstimate(Number(highPoint));
  return season;
}

// How many more winter walks would bring `good` of `total` up to the quota.
function walksShortOfQuota(good, total, quota = WINTER_QUOTA){
  if(total === 0 || good / total >= quota) return 0;
  return Math.ceil((quota * total - good) / (1 - quota));
}

function share(good, total){
  return total ? good / total : 0;
}

function summarise(trails, addedIds){
  const byRegion = new Map();
  let good = 0;
  const added = { total: 0, good: 0, goodIds: [], otherIds: [] };
  for(const trail of trails){
    const isGood = goodAllWinter(trail.season);
    if(isGood) good += 1;
    const region = trail.region || 'unknown';
    const row = byRegion.get(region) || { region, total: 0, good: 0 };
    row.total += 1;
    if(isGood) row.good += 1;
    byRegion.set(region, row);
    if(addedIds && addedIds.has(trail.id)){
      added.total += 1;
      if(isGood){ added.good += 1; added.goodIds.push(trail.id); }
      else added.otherIds.push(trail.id);
    }
  }
  const regions = [...byRegion.values()]
    .map(row => ({ ...row, share: share(row.good, row.total) }))
    .sort((a, b) => b.total - a.total || a.region.localeCompare(b.region));
  return {
    quota: WINTER_QUOTA,
    total: trails.length,
    good,
    share: share(good, trails.length),
    regions,
    added: addedIds ? {
      ...added,
      share: share(added.good, added.total),
      shortBy: walksShortOfQuota(added.good, added.total),
      meetsQuota: added.total === 0 || share(added.good, added.total) >= WINTER_QUOTA,
    } : null,
  };
}

function git(root, args){
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim();
}

// The walks that are in the catalogue now and were not at `since` (a date or a
// git ref). Every walk has its own file in data/trail-details, so the file
// names there are the catalogue's ids at any commit.
function addedSince(root, since){
  const sha = /^\d{4}-\d{2}-\d{2}$/.test(since)
    ? git(root, ['rev-list', '-1', `--before=${since}T00:00:00Z`, 'HEAD'])
    : git(root, ['rev-parse', '--verify', `${since}^{commit}`]);
  if(!sha) throw new Error(`No commit before ${since}`);
  const listing = git(root, ['ls-tree', '--name-only', sha, 'data/trail-details/']);
  if(!listing) throw new Error(`No data/trail-details at ${sha.slice(0, 9)}`);
  const before = new Set(listing.split('\n').map(file => path.basename(file, '.js')));
  return { sha, ids: id => !before.has(id) };
}

function daysAgo(days, now = new Date()){
  return new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
}

function parseArgs(argv){
  const args = { since: null, check: false, json: false, candidate: null, months: null };
  for(let i = 0; i < argv.length; i += 1){
    const arg = argv[i];
    if(arg === '--check') args.check = true;
    else if(arg === '--json') args.json = true;
    else if(arg === '--since') args.since = argv[++i];
    else if(arg === '--candidate') args.candidate = Number(argv[++i]);
    else if(arg === '--months') args.months = String(argv[++i]).split(',').map(Number).filter(m => m >= 1 && m <= 12);
    else throw new Error(`Unknown option ${arg}`);
  }
  return args;
}

function pct(value){
  return `${Math.round(value * 100)}%`;
}

function main(argv){
  const args = parseArgs(argv);
  if(args.candidate !== null){
    if(!Number.isFinite(args.candidate)) throw new Error('--candidate takes the walk\'s high point in metres');
    const season = candidateSeason(args.candidate, args.months);
    const yes = goodAllWinter(season);
    const best = words.bestMonths(season) || [];
    console.log(`${yes ? 'Counts' : 'Does not count'} as a winter walk: best months ${best.map(m => words.MONTH_NAMES[m - 1].slice(0, 3)).join(', ') || 'none'}`
      + `${args.months ? ' (board months)' : ` (snow estimate at ${season.highPoint} m)`}.`);
    if(yes) console.log('Unless a lift, a road or a ski run on the line shuts it in winter.');
    return 0;
  }

  const root = path.resolve(__dirname, '..');
  const { loadProductionTrails } = require('./load-production-trails');
  const trails = loadProductionTrails(root);
  const since = args.since || daysAgo(DEFAULT_SINCE_DAYS);
  let added = null;
  let sha = null;
  let addedError = null;
  try {
    const result = addedSince(root, since);
    sha = result.sha;
    added = new Set(trails.map(trail => trail.id).filter(result.ids));
  } catch(error){
    addedError = error.message;
  }
  const summary = summarise(trails, added);
  summary.since = since;
  summary.sinceCommit = sha;

  if(args.json){
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Good all winter (Dec–Feb): ${summary.good} of ${summary.total} walks (${pct(summary.share)}).`);
    console.log('');
    console.log('By region:');
    for(const row of summary.regions) console.log(`  ${row.region.padEnd(14)} ${String(row.good).padStart(4)} of ${String(row.total).padStart(4)}  ${pct(row.share)}`);
    console.log('');
    if(summary.added){
      const a = summary.added;
      console.log(`Added since ${since} (${sha.slice(0, 9)}): ${a.total} walks, ${a.good} good all winter (${pct(a.share)}). Quota ${pct(WINTER_QUOTA)}.`);
      console.log(a.meetsQuota ? '  Meets the quota.' : `  Below the quota: ${a.shortBy} more winter walk${a.shortBy === 1 ? '' : 's'} would meet it.`);
      if(a.goodIds.length){
        const shown = a.goodIds.slice(-8);
        const more = a.goodIds.length - shown.length;
        console.log(`  Winter walks${more ? ' (latest 8)' : ''}: ${shown.join(', ')}${more ? `, and ${more} more (--json lists all)` : ''}`);
      }
    } else {
      console.log(`Walks added since ${since}: not measured (${addedError}).`);
    }
  }
  if(args.check && summary.added && !summary.added.meetsQuota) return 1;
  return 0;
}

if(require.main === module){
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch(error){
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = { WINTER_MONTHS, WINTER_QUOTA, goodAllWinter, candidateSeason, walksShortOfQuota, summarise, addedSince };
