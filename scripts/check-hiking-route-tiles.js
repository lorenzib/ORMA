#!/usr/bin/env node
// Says whether the hiking route tiles about to be published are fit to go
// out: present, and built recently enough that the weekly refresh is still
// working. The deploy turns anything but "ok" into an issue, because the maps
// look the same either way: missing tiles fall back to Waymarked Trails and
// stale ones are simply last month's routes.
//
//   node scripts/check-hiking-route-tiles.js <tiles-dir>
//
// Prints one JSON line, {state, builtAt, ageDays, tiles}, where state is
// "ok", "stale" or "missing". The build stamps built-at.txt; a set saved
// before the stamp existed is dated by its metadata.json instead.
const fs = require('fs');
const path = require('path');

// Two Mondays missed, with a day's slack for a late timer.
const STALE_AFTER_DAYS = 16;

function countTiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countTiles(path.join(dir, entry.name));
    else if (entry.name.endsWith('.pbf')) count += 1;
  }
  return count;
}

function builtAt(dir) {
  const stamp = path.join(dir, 'built-at.txt');
  if (fs.existsSync(stamp)) {
    const date = new Date(fs.readFileSync(stamp, 'utf8').trim());
    if (!Number.isNaN(date.getTime())) return date;
  }
  const metadata = path.join(dir, 'metadata.json');
  return fs.existsSync(metadata) ? fs.statSync(metadata).mtime : null;
}

function checkTiles(dir, now = new Date()) {
  const tiles = fs.existsSync(dir) ? countTiles(dir) : 0;
  if (!tiles) return { state: 'missing', builtAt: null, ageDays: null, tiles: 0 };
  const built = builtAt(dir);
  if (!built) return { state: 'stale', builtAt: null, ageDays: null, tiles };
  const ageDays = Math.floor((now - built) / 86400000);
  return {
    state: ageDays > STALE_AFTER_DAYS ? 'stale' : 'ok',
    builtAt: built.toISOString(),
    ageDays,
    tiles,
  };
}

module.exports = { checkTiles, STALE_AFTER_DAYS };

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: node scripts/check-hiking-route-tiles.js <tiles-dir>');
    process.exit(2);
  }
  console.log(JSON.stringify(checkTiles(dir)));
}
