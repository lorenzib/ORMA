#!/usr/bin/env node
'use strict';

// Which hand-curated season dates need re-reading: the lifts, roads, road
// access rules (summer bookings, winter tolls, shuttles) and huts in
// data/*-seasons.json, and the walks held for want of dates. Operators publish summer dates in spring and winter dates in
// autumn, so there are two check windows a year:
//
//   spring check, from 1 April:  summer dates should be for this summer
//   autumn check, from 1 October: winter dates should be for this winter
//
// A dated entry is due when the window for its next season has opened and its
// dates are still for an earlier one. An entry with no year (a road's usual
// season, a held walk) is due when it was last read before the latest window
// opened, and so is an access rule, whose dates sit in its sentence.
// Nothing here changes a walk: it is a to-do list.
//
//   node scripts/season-dates-review.js [--today=YYYY-MM-DD] [--json]

const fs = require('fs');
const path = require('path');

const SPRING = '04-01';
const AUTUMN = '10-01';

// The latest check window opened on or before `today`: { date, kind }.
function latestWindow(today){
  const year = Number(today.slice(0, 4));
  const md = today.slice(5);
  if(md >= AUTUMN) return { date: `${year}-${AUTUMN}`, kind: 'autumn' };
  if(md >= SPRING) return { date: `${year}-${SPRING}`, kind: 'spring' };
  return { date: `${year - 1}-${AUTUMN}`, kind: 'autumn' };
}

// The summer and winter (by its first year) that should be dated by now.
function expectedSeasons(today){
  const year = Number(today.slice(0, 4));
  const md = today.slice(5);
  return {
    summer: md >= SPRING ? year : year - 1,
    winter: md >= AUTUMN ? year : year - 1,
  };
}

const firstYear = text => { const m = /(\d{4})/.exec(String(text || '')); return m ? Number(m[1]) : null; };
const isWinterMonth = m => m >= 11 || m <= 4;

// Which seasons a set of periods speaks for: summer, winter or both.
function seasonsOf(entry){
  if(entry.allYear) return ['summer', 'winter'];
  const months = entry.knownMonths || [];
  if(months.length && months.length < 12) return months.every(isWinterMonth) ? ['winter'] : ['summer'];
  const kinds = new Set();
  for(const { from, to } of entry.periods || []){
    for(const md of [from, to]) kinds.add(isWinterMonth(Number(md.slice(0, 2))) ? 'winter' : 'summer');
  }
  return [...kinds];
}

// Each dated season the entry holds, as { season, year }.
function datedSeasons(entry){
  const df = entry.datesFor;
  if(df && typeof df === 'object') return Object.entries(df).map(([season, text]) => ({ season, year: firstYear(text) }));
  const year = firstYear(df);
  return seasonsOf(entry).map(season => ({ season, year }));
}

function reviewDated(kind, id, entry, today){
  const want = expectedSeasons(today);
  const late = datedSeasons(entry).filter(({ season, year }) => year !== null && year < want[season]);
  if(!late.length) return null;
  return {
    kind, id, name: entry.name || id, url: entry.url || '', readOn: entry.accessedAt || '',
    why: entry.allYear
      ? `dates are for ${late[0].year}; ${want.summer} dates are due`
      : late.map(({ season, year }) => `${season} dates are for ${year}; ${want[season]} ${season} dates are due`).join('; '),
  };
}

function reviewUndated(kind, id, entry, today, why){
  const window = latestWindow(today);
  const readOn = entry.accessedAt || '';
  if(readOn && readOn >= window.date) return null;
  return { kind, id, name: entry.name || id, url: entry.url || '', readOn, why: `${why}; last read ${readOn || 'never'}, before the ${window.kind} check (${window.date})` };
}

// The date a held reason says it was checked: "(checked 10 Nov 2026)".
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function checkedOn(reason){
  const all = [...String(reason).matchAll(/(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})/g)];
  if(!all.length) return '';
  const dates = all.map(m => `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  return dates.sort().pop();
}

function readJson(root, file){
  const full = path.join(root, 'data', file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, 'utf8')) : {};
}

function seasonDatesReview(root, today){
  const due = [];
  const counts = { lifts: 0, roads: 0, access: 0, huts: 0, held: 0 };
  const push = item => { if(item) due.push(item); };
  const lifts = readJson(root, 'lift-seasons.json');
  for(const [id, lift] of Object.entries(lifts.lifts || {})){ counts.lifts += 1; push(reviewDated('lift', id, lift, today)); }
  for(const [id, reason] of Object.entries(lifts.held || {})){
    counts.held += 1;
    push(reviewUndated('held lift walk', id, { accessedAt: checkedOn(reason) }, today, 'held for want of lift dates'));
  }
  const roads = readJson(root, 'road-seasons.json');
  for(const [id, road] of Object.entries(roads.roads || {})){ counts.roads += 1; push(reviewUndated('road', id, road, today, 'usual season, no year')); }
  for(const [id, rule] of Object.entries(roads.access || {})){ counts.access += 1; push(reviewUndated('access rule', id, { ...rule, name: rule.line.slice(0, 70) + '…' }, today, 'dates are in its sentence')); }
  const huts = readJson(root, 'hut-seasons.json');
  for(const [id, hut] of Object.entries(huts.huts || {})){ counts.huts += 1; push(reviewDated('hut', id, hut, today)); }
  return { today, window: latestWindow(today), expected: expectedSeasons(today), counts, due };
}

if(require.main === module){
  const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1];
  const today = arg('today') || new Date().toISOString().slice(0, 10);
  const report = seasonDatesReview(path.join(__dirname, '..'), today);
  if(process.argv.includes('--json')){ console.log(JSON.stringify(report, null, 2)); process.exit(0); }
  const { counts, due, window, expected } = report;
  const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  console.log(`Season dates on ${today}: ${n(counts.lifts, 'lift', 'lifts')}, ${n(counts.roads, 'road', 'roads')}, ${n(counts.access, 'road access rule', 'road access rules')}, ${n(counts.huts, 'hut', 'huts')}, ${n(counts.held, 'held walk', 'held walks')}.`);
  console.log(`Latest check: ${window.kind} (${window.date}). Expecting ${expected.summer} summer dates and ${expected.winter}/${String(expected.winter + 1).slice(2)} winter dates.`);
  if(!due.length){ console.log('Nothing to re-read.'); process.exit(0); }
  console.log(`${due.length} to re-read:`);
  for(const item of due) console.log(`  - ${item.kind} ${item.name}: ${item.why}${item.url ? ` (${item.url})` : ''}`);
}

module.exports = { seasonDatesReview, latestWindow, expectedSeasons, datedSeasons, checkedOn };
