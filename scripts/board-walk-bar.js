#!/usr/bin/env node
'use strict';

/**
 * board-walk-bar — the bar a board walk must clear before it is Verified.
 *
 *   node scripts/board-walk-bar.js            the Verified board walks that fail
 *   node scripts/board-walk-bar.js --json     the same, as JSON
 *   node scripts/board-walk-bar.js --id <id>  one walk, in full
 *
 * A walk the board publishes is drawn on OSM paths by build-board-line.js. The
 * builder checks that the drawn line is the board's walk (95% each way within
 * 25 m, length within 10%). That is not enough to follow it. Ortisei – Passo
 * Sella passed with 100% and 96.5% and still folded over itself in Ortisei:
 * out along a side street and back, arrows pointing both ways. Its page also
 * said "No verified numbered sequence is currently recorded", because the
 * directions the audit wrote never reach the page. So two more signs:
 *
 * 1. The line is clean. It does not go out along a path and come straight back
 *    mid-walk (a spur: more than 50 m retraced at a turn, on the same path),
 *    and it does not run over itself. A walk declared an out-and-back may turn
 *    round once, near the middle; a walk declared a lollipop may walk its stem
 *    both ways. A real side trip -- to a waterfall, a viewpoint -- is declared
 *    in the audit as `sideTrips: [{ km, note }]` and is then not a spur.
 * 2. The walk has directions: where to start and which way to go, with path
 *    numbers or named turns, in words a walker can follow.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { meters, densify } = require('./build-board-line');

const ROOT = path.resolve(__dirname, '..');

const STEP_M = 10;            // the line is read every 10 m
// A line drawn on OSM ways that comes back on itself comes back on the same
// way, so the two passes lie within a few metres. Mountain hairpins put two
// different ways 5-15 m apart, and must not count.
const SAME_TRACK_M = 5;       // two points this close are on the same track
const SPUR_MIN_M = 50;        // retraced further than a snap (build-board-line SNAP_M) is a spur
const OVERLAP_GAP_M = 80;     // a point is "over itself" only against line this far away along it
const MAX_OVERLAP = 0.10;     // share of a non-out-and-back line allowed over itself
const TIP_WINDOW = 0.15;      // an out-and-back turns within 15% of its middle

/**
 * Spurs: places the line turns and comes straight back on the same track.
 * Each is { km, metres } -- where it turns and how far it retraces.
 */
function spursOf(points, along) {
  const spurs = [];
  for (let i = 1; i + 1 < points.length; i += 1) {
    let reach = 0;
    while (i - reach - 1 >= 0 && i + reach + 1 < points.length
      && meters(points[i - reach - 1], points[i + reach + 1]) <= SAME_TRACK_M) reach += 1;
    const retraced = reach ? along[i] - along[i - reach] : 0;
    if (retraced <= SPUR_MIN_M) continue;
    const last = spurs[spurs.length - 1];
    // One turn is seen from several points around it; keep the deepest.
    if (last && along[i] - last.at <= 2 * SPUR_MIN_M) {
      if (retraced > last.metres) Object.assign(last, { at: along[i], metres: retraced });
      continue;
    }
    spurs.push({ at: along[i], metres: retraced });
  }
  return spurs.map(spur => ({ km: Math.round(spur.at / 10) / 100, metres: Math.round(spur.metres) }));
}

/**
 * Which points lie on another part of the line at least OVERLAP_GAP_M away
 * along it: the line running over itself.
 */
function overlapFlags(points, along) {
  const cell = 0.0002; // about 20 m: neighbours to compare against
  const grid = new Map();
  const key = (a, b) => `${a},${b}`;
  points.forEach((p, i) => {
    const k = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  return points.map((p, i) => {
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const j of grid.get(key(gx + dx, gy + dy)) || []) {
          if (Math.abs(along[i] - along[j]) >= OVERLAP_GAP_M && meters(p, points[j]) <= SAME_TRACK_M) return true;
        }
      }
    }
    return false;
  });
}

/**
 * What the line does, read from the line alone:
 *   clean         never on itself (a loop or one way)
 *   out-and-back  out and back the same way, turning once near the middle
 *   lollipop      a loop reached by a stem walked both ways, and nothing else
 *   folds         goes out along a path and comes straight back mid-walk (spurs)
 *   overlaps      runs over itself somewhere other than a stem
 */
function readShape(points, along, flags, spurs) {
  const total = along[along.length - 1];
  const over = flags.filter(Boolean).length / (flags.length || 1);
  const deepest = spurs.length ? spurs.reduce((best, spur) => (spur.metres > best.metres ? spur : best)) : null;
  const tipNearMiddle = deepest && Math.abs(deepest.km * 1000 - total / 2) <= TIP_WINDOW * total;
  const others = spurs.filter(spur => spur !== deepest);
  if (over >= 0.85 && tipNearMiddle && !others.length) return { kind: 'out-and-back', extraSpurs: [] };
  if (spurs.length) return { kind: 'folds', extraSpurs: spurs };
  if (over <= MAX_OVERLAP) return { kind: 'clean', extraSpurs: [] };
  // A stem: the line runs over itself in one stretch near its start and one
  // near its end -- the same path walked out and back -- and nowhere else.
  const runs = [];
  flags.forEach((flag, i) => {
    if (!flag) return;
    const last = runs[runs.length - 1];
    if (last && along[i] - along[last.to] <= OVERLAP_GAP_M) last.to = i;
    else runs.push({ from: i, to: i });
  });
  const near = TIP_WINDOW * total;
  if (runs.length === 2 && along[runs[0].from] <= near && total - along[runs[1].to] <= near) {
    return { kind: 'lollipop', extraSpurs: [] };
  }
  return { kind: 'overlaps', extraSpurs: [] };
}

// The shape a walk may declare, and the line shapes each accepts.
const ACCEPTS = {
  loop: ['clean'],
  'point-to-point': ['clean'],
  'out-and-back': ['out-and-back', 'clean'],
  lollipop: ['lollipop', 'clean'],
  // The line builder, before any audit has said what the walk is.
  any: ['clean', 'out-and-back', 'lollipop'],
};

/**
 * Whether a drawn line ([lat, lng] points) can be followed, for the shape the
 * walk declares ('loop', 'point-to-point', 'out-and-back' or 'lollipop').
 */
function lineShape(line, { declared = 'point-to-point', sideTrips = [] } = {}) {
  const points = densify(line, STEP_M);
  const along = [0];
  for (let i = 1; i < points.length; i += 1) along.push(along[i - 1] + meters(points[i - 1], points[i]));
  const total = along[along.length - 1];
  // A declared side trip is walked out and back on purpose: neither its turn
  // nor its two passes count against the line.
  const declaredTrip = spur => sideTrips.some(trip => Math.abs(Number(trip && trip.km) - spur.km) <= 0.15);
  const trips = spursOf(points, along).filter(declaredTrip);
  const spurs = spursOf(points, along).filter(spur => !declaredTrip(spur));
  const flags = overlapFlags(points, along).map((flag, i) => flag
    && !trips.some(trip => Math.abs(along[i] - trip.km * 1000) <= trip.metres + SAME_TRACK_M));
  const overlap = flags.filter(Boolean).length / (flags.length || 1);
  let { kind } = readShape(points, along, flags, spurs);
  // A declared out-and-back that also has spurs folds; its tip is not one of them.
  let shownSpurs = spurs;
  if (kind === 'folds' && declared === 'out-and-back') {
    const tip = spurs.reduce((best, spur) => (spur.metres > best.metres ? spur : best));
    if (Math.abs(tip.km * 1000 - total / 2) <= TIP_WINDOW * total) shownSpurs = spurs.filter(spur => spur !== tip);
    if (!shownSpurs.length) kind = 'out-and-back';
  }
  const problems = [];
  if (kind === 'folds') {
    problems.push(`the line goes out and comes straight back ${shownSpurs.length === 1 ? 'once' : `${shownSpurs.length} times`} mid-walk, at `
      + shownSpurs.slice(0, 6).map(spur => `km ${spur.km.toFixed(2)} (${spur.metres} m)`).join(', ')
      + (shownSpurs.length > 6 ? ` and ${shownSpurs.length - 6} more` : ''));
  } else if (kind === 'overlaps') {
    problems.push(`${Math.round(overlap * 100)}% of the line runs over itself mid-walk`);
  } else if (!(ACCEPTS[declared] || ACCEPTS['point-to-point']).includes(kind)) {
    problems.push(`the line is ${kind === 'out-and-back' ? 'an out-and-back' : `a ${kind}`} (${Math.round(overlap * 100)}% walked twice) but the page calls the walk ${declared === 'out-and-back' ? 'an out-and-back' : `a ${declared}`}`);
  }
  return {
    km: Math.round(total / 10) / 100,
    overlap: Math.round(overlap * 1000) / 1000,
    declared,
    kind,
    spurs: shownSpurs,
    sideTrips: trips,
    problems,
    clean: !problems.length,
  };
}

/**
 * Whether the walk has directions a walker can follow.
 *
 * Board walks carry them as the audit's route sentence
 * (`routeAudit.routeNumbers`): where to start, and the path numbers or named
 * turns from there. A sentence that only says to follow the signs, or names
 * no second place, is not directions.
 */
function directionsOf(trail) {
  const text = String((trail && trail.routeAudit && trail.routeAudit.routeNumbers) || '').trim();
  const problems = [];
  if (!text) {
    problems.push('no written directions');
  } else {
    const words = text.split(/\s+/).length;
    const hasStart = /\b(from|start|begin|leave|at the)\b/i.test(text);
    const hasWay = /\b(to|towards|onto|then|up|down|along|past|through|across|over|via|back)\b/i.test(text);
    if (words < 15) problems.push(`the directions are only ${words} words`);
    if (!hasStart || !hasWay) problems.push('the directions do not say where to start and which way to go');
  }
  // What the page shows today. The trail page prints route numbers or a
  // structured guidance block; the audit's sentence is not one of them, so a
  // board walk's page reads "No verified numbered sequence is currently recorded".
  const shownOnPage = Boolean(trail && (trail.routeNumberGuidance
    || ['routeRefs', 'routeNumbers', 'trailRefs', 'trailNumbers', 'ref', 'decisionPoints', 'routeRefSegments']
      .some(key => trail[key] != null && (!Array.isArray(trail[key]) || trail[key].length))));
  return { text, problems, written: !problems.length, shownOnPage };
}

/** The trails as the site sees them, with the audit overlay applied. */
function loadTrails(root = ROOT) {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js', 'board-trails-data.js', 'trail-audits.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return vm.runInContext('trails', context);
}

function isVerified(trail) {
  const g = trail && trail.graduation;
  return Boolean(g && g.status === 'verified' && Array.isArray(g.completed) && Array.isArray(g.required)
    && g.required.every(check => g.completed.includes(check)));
}

/** Every Verified board walk, judged against the bar. */
function audit(root = ROOT) {
  const routes = JSON.parse(fs.readFileSync(path.join(root, 'data', 'board-line-routes.geojson'), 'utf8'));
  const lines = new Map(routes.features.map(feature => [feature.properties.trail_id, feature]));
  return loadTrails(root)
    .filter(trail => trail.source === 'board-line' && isVerified(trail))
    .map(trail => {
      const feature = lines.get(trail.id);
      const declared = feature && feature.properties.official && feature.properties.official.there_and_back
        ? 'out-and-back'
        : trail.routeShape || (feature && feature.properties.loop ? 'loop' : 'point-to-point');
      const line = feature
        ? lineShape(feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]), { declared, sideTrips: trail.sideTrips || [] })
        : { clean: false, kind: null, declared, problems: ['no drawn line in data/board-line-routes.geojson'], spurs: [], overlap: null, km: null };
      const directions = directionsOf(trail);
      return {
        id: trail.id,
        name: trail.name,
        operator: feature ? feature.properties.operator : trail.operator,
        line,
        directions,
        // 29 October 2026: the directions must be on the page, not only in
        // the research notes, or the walk cannot be followed.
        passes: line.clean && directions.written && directions.shownOnPage,
      };
    });
}

function main(argv = process.argv.slice(2)) {
  const results = audit();
  const idAt = argv.indexOf('--id');
  if (idAt >= 0) {
    console.log(JSON.stringify(results.find(result => result.id === argv[idAt + 1]) || null, null, 2));
    return;
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  const lineFails = results.filter(result => !result.line.clean);
  const textFails = results.filter(result => !result.directions.written);
  const notShown = results.filter(result => !result.directions.shownOnPage);
  console.log(`${results.length} Verified board walks.`);
  console.log(`${lineFails.length} fail the line check:`);
  const groups = [
    ['folds', 'The line goes out and comes straight back mid-walk'],
    ['overlaps', 'The line runs over itself mid-walk'],
    ['out-and-back', 'The line is an out-and-back; the page says otherwise'],
    ['lollipop', 'The line is a loop on a stem walked both ways; the page says otherwise'],
    ['clean', 'Other'],
    [null, 'No drawn line'],
  ];
  for (const [kind, title] of groups) {
    const group = lineFails.filter(result => result.line.kind === kind);
    if (!group.length) continue;
    console.log(`\n  ${title} (${group.length}):`);
    for (const result of group) console.log(`    ${result.id} (page: ${result.line.declared}): ${result.line.problems.join('; ')}`);
  }
  console.log(`\n${textFails.length} have no usable written directions:`);
  for (const result of textFails) console.log(`  ${result.id}: ${result.directions.problems.join('; ')}`);
  console.log(`${notShown.length} pages show no directions (the audit's route sentence is not printed).`);
}

if (require.main === module) main();

module.exports = {
  STEP_M, SAME_TRACK_M, SPUR_MIN_M, OVERLAP_GAP_M, MAX_OVERLAP, ACCEPTS,
  lineShape, directionsOf, loadTrails, isVerified, audit,
};
