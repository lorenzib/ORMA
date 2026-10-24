#!/usr/bin/env node
'use strict';

/**
 * build-board-line — a walk the operator publishes becomes a line on OSM paths.
 *
 *   node scripts/build-board-line.js --id fassa-da-canazei-a-penia \
 *     --name "Da Canazei a Penìa" --operator "APT Val di Fassa" \
 *     --source https://www.fassa.com/it/itinerari/da-canazei-a-penia \
 *     --guide https://www.outdooractive.com/it/r/38079215 \
 *     --km 6.3 --ascent 58 --time 1:35 [--apply]
 *
 * Dry run by default.
 *
 * Most walks a tourist board publishes are not one route in OpenStreetMap. A
 * board's loop is stitched from several numbered paths, and OSM carries each
 * number as its own one-way stretch: of 133 South Tyrol board walks matched to
 * a numbered relation, one was a closed loop, and of 30 Val di Fassa walks the
 * board marks "dogs accepted", one matched a relation end to end. The importer
 * starts from a relation, so none of them could enter the catalogue.
 *
 * This starts from the operator's own published line instead, as a guide. The
 * guide is never stored or published -- its licence is rarely stated, which is
 * why the operating standard says an official GPX is a guide and never the line
 * itself. What is stored is a line drawn on OSM ways that follows it: the
 * guide is sampled every 200 m, each sample is snapped to the nearest OSM
 * path, and the cheapest way between samples is found on the OSM network, with
 * a way costing more the further it strays from the guide.
 *
 * The result is refused unless it is the same walk: 95% of the guide within
 * 25 m of the line and 95% of the line within 25 m of the guide, and the line
 * no more than 10% longer or shorter than the distance the operator publishes.
 * A refused walk writes nothing.
 *
 * `npm run promote:trails -- --region board` then derives the record the way it
 * does for an imported relation: elevation, profile, water, rifugi and terrain
 * from the line. The start and direction stay the operator's.
 */

const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTES_FILE = path.join('data', 'board-line-routes.geojson');
const UA = 'ORMA/1.0 (github lorenzib/ORMA; board-line builder)';

const SAMPLE_M = 200;          // guide sampled this often for waypoints
const SNAP_M = 50;             // a waypoint must have an OSM path this close
const COVER_M = 25;            // a point counts as on the other line within this
const MIN_COVER = 0.95;        // both ways
const MAX_LENGTH_OFF = 0.10;   // against the operator's published distance
const TILE_DEG = 0.01;         // OSM API map tiles
const STRAY_M = 15;            // cost rises with the square of distance / this
const LOOP_CLOSE_M = 100;

// Ways a walker can use. Motorways and trunk roads are never a walk; the rest
// are allowed and the guide decides between them.
const NOT_WALKABLE = /^(motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway|bus_guideway|abandoned|platform)$/;

const R = 6371000;
const rad = d => d * Math.PI / 180;
/** Great-circle distance between two [lat, lng] points, metres. */
function meters(a, b) {
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2
    + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distance from point p to segment a-b, metres, on a local flat projection. */
function segmentMeters(p, a, b) {
  const kx = Math.cos(rad(p[0])) * R * Math.PI / 180;
  const ky = R * Math.PI / 180;
  const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky;
  const bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / ((dx * dx + dy * dy) || 1)));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function lineMeters(line) {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) total += meters(line[i - 1], line[i]);
  return total;
}

/** Points every `step` metres along a line, its ends included. */
function densify(line, step) {
  const out = [line[0]];
  for (let i = 1; i < line.length; i += 1) {
    const length = meters(line[i - 1], line[i]);
    const pieces = Math.max(1, Math.ceil(length / step));
    for (let j = 1; j <= pieces; j += 1) {
      const t = j / pieces;
      out.push([line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])]);
    }
  }
  return out;
}

/** Share of `points` lying within `tolerance` metres of `line`. */
function coverage(points, line, tolerance = COVER_M) {
  if (!points.length || line.length < 2) return 0;
  let near = 0;
  for (const p of points) {
    for (let i = 1; i < line.length; i += 1) {
      if (segmentMeters(p, line[i - 1], line[i]) <= tolerance) { near += 1; break; }
    }
  }
  return near / points.length;
}

/**
 * The guide as the operator's public page describes it.
 *
 * Outdooractive tour pages carry schema.org JSON-LD: the line as a GeoShape
 * (`lat lng lat lng …`), the start and end places, and the author. That is the
 * page anyone can open; nothing here uses an API key.
 */
function parseGuide(html) {
  const blocks = [...String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const find = (value, key) => {
    if (value && typeof value === 'object') {
      if (!Array.isArray(value) && key in value) return value[key];
      for (const child of Object.values(value)) {
        const found = find(child, key);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  for (const block of blocks) {
    let data;
    try { data = JSON.parse(block); } catch { continue; }
    const line = find(data, 'line');
    if (typeof line !== 'string') continue;
    const numbers = line.trim().split(/\s+/).map(Number);
    const points = [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
    if (points.length < 2 || points.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) continue;
    const from = find(data, 'fromLocation');
    const to = find(data, 'toLocation');
    const author = find(data, 'author');
    const place = loc => loc && loc.geo
      ? { name: loc.name || null, lat: Number(loc.geo.latitude), lng: Number(loc.geo.longitude) }
      : null;
    return {
      line: points,
      start: place(from),
      end: place(to),
      author: Array.isArray(author) ? (author[0]?.name || null)
        : author && typeof author === 'object' ? (author.name || null) : (author || null),
    };
  }
  return null;
}

/** The walkable OSM network in a set of OSM API map answers. */
function buildGraph(answers) {
  const nodes = new Map();
  const ways = new Map();
  for (const answer of answers) {
    for (const element of answer.elements || []) {
      if (element.type === 'node') nodes.set(element.id, [element.lat, element.lon]);
      else if (element.type === 'way' && element.tags && element.tags.highway
        && !NOT_WALKABLE.test(element.tags.highway)
        && element.tags.foot !== 'no' && element.tags.access !== 'no' && element.tags.access !== 'private') {
        ways.set(element.id, element);
      }
    }
  }
  const adjacency = new Map();
  const link = (a, b, edge) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a).push({ to: b, ...edge });
  };
  for (const way of ways.values()) {
    for (let i = 1; i < way.nodes.length; i += 1) {
      const a = way.nodes[i - 1], b = way.nodes[i];
      if (!nodes.has(a) || !nodes.has(b)) continue;
      const length = meters(nodes.get(a), nodes.get(b));
      const edge = { way: way.id, length, surface: way.tags.surface || null };
      link(a, b, edge); link(b, a, edge);
    }
  }
  return { nodes, adjacency, ways };
}

/** Each edge's cost: its length, more the further its middle is from the guide. */
function strayCosts(graph, guide) {
  const cost = new Map();
  for (const [from, edges] of graph.adjacency) {
    const a = graph.nodes.get(from);
    for (const edge of edges) {
      const key = from < edge.to ? `${from}-${edge.to}-${edge.way}` : `${edge.to}-${from}-${edge.way}`;
      if (cost.has(key)) { edge.cost = cost.get(key); continue; }
      const b = graph.nodes.get(edge.to);
      const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let stray = Infinity;
      for (let i = 1; i < guide.length; i += 1) stray = Math.min(stray, segmentMeters(middle, guide[i - 1], guide[i]));
      edge.cost = edge.length * (1 + (stray / STRAY_M) ** 2);
      cost.set(key, edge.cost);
    }
  }
}

function nearestNode(graph, point, within) {
  let best = null, bestMeters = within;
  for (const [id, coord] of graph.nodes) {
    if (!graph.adjacency.has(id)) continue;
    const d = meters(point, coord);
    if (d < bestMeters) { bestMeters = d; best = id; }
  }
  return best;
}

/** Cheapest path between two nodes: node ids and the edges taken. */
function cheapest(graph, from, to) {
  if (from === to) return { nodes: [from], edges: [] };
  const dist = new Map([[from, 0]]);
  const back = new Map();
  const heap = [[0, from]];
  const push = item => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]]; i = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let smallest = i;
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]]; i = smallest;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, node] = pop();
    if (node === to) break;
    if (d > dist.get(node)) continue;
    for (const edge of graph.adjacency.get(node) || []) {
      const next = d + edge.cost;
      if (next < (dist.has(edge.to) ? dist.get(edge.to) : Infinity)) {
        dist.set(edge.to, next);
        back.set(edge.to, { from: node, edge });
        push([next, edge.to]);
      }
    }
  }
  if (!back.has(to)) return null;
  const nodes = [to];
  const edges = [];
  let at = to;
  while (at !== from) {
    const step = back.get(at);
    edges.unshift(step.edge);
    nodes.unshift(step.from);
    at = step.from;
  }
  return { nodes, edges };
}

/**
 * The guide drawn on the OSM network.
 *
 * Returns the line, the ways it uses in order, its surfaces and its length, or
 * `{ refused }` naming the first guide point with no OSM path near it.
 */
function matchGuide(graph, guide) {
  strayCosts(graph, guide);
  const samples = densify(guide, SAMPLE_M);
  const waypoints = [];
  let along = 0;
  for (let i = 0; i < samples.length; i += 1) {
    if (i) along += meters(samples[i - 1], samples[i]);
    const node = nearestNode(graph, samples[i], SNAP_M);
    if (node === null) return { refused: `no OSM path within ${SNAP_M} m of the guide at km ${(along / 1000).toFixed(2)}` };
    if (waypoints[waypoints.length - 1] !== node) waypoints.push(node);
  }
  let nodes = [waypoints[0]];
  let edges = [];
  for (let i = 1; i < waypoints.length; i += 1) {
    const leg = cheapest(graph, waypoints[i - 1], waypoints[i]);
    if (!leg) return { refused: `the OSM network does not connect the guide between waypoints ${i} and ${i + 1}` };
    nodes = nodes.concat(leg.nodes.slice(1));
    edges = edges.concat(leg.edges);
  }
  // A waypoint snapped a few metres off the guide makes the line step out to
  // it and back. Those spurs are not part of the walk -- but only short ones
  // are spurs. A walk that goes up a path and comes back down it is an
  // out-and-back, and removing every there-and-back step deleted all of it:
  // two Val di Fassa walks came out as 0.00 km. Removing short steps one at a
  // time is no better, because a long way back made of short pieces unwinds a
  // piece at a time. So each there-and-back is measured whole, out to its turn,
  // and removed only if all of it is shorter than a snap.
  for (let i = 1; i + 1 < nodes.length; i += 1) {
    if (nodes[i - 1] !== nodes[i + 1]) continue;
    let reach = 1;
    while (i - reach - 1 >= 0 && i + reach + 1 < nodes.length && nodes[i - reach - 1] === nodes[i + reach + 1]) reach += 1;
    const out = edges.slice(i - reach, i).reduce((sum, edge) => sum + edge.length, 0);
    if (out <= SNAP_M) {
      nodes.splice(i - reach + 1, 2 * reach);
      edges.splice(i - reach, 2 * reach);
      i = Math.max(0, i - reach - 1);
    } else {
      i += reach;
    }
  }
  const line = nodes.map(id => graph.nodes.get(id));
  const surfaces = {};
  const wayOrder = [];
  for (const edge of edges) {
    if (wayOrder[wayOrder.length - 1] !== edge.way) wayOrder.push(edge.way);
    const key = edge.surface || null;
    if (key) surfaces[key] = Math.round(((surfaces[key] || 0) + edge.length / 1000) * 100) / 100;
  }
  for (const key of Object.keys(surfaces)) surfaces[key] = Math.round(surfaces[key] * 10) / 10;
  return { line, ways: wayOrder, surfaces, meters: lineMeters(line) };
}

/** Whether a drawn line is the operator's walk, and why not when it is not. */
function judge(guide, line, officialKm) {
  if (line.length < 2) return { keep: false, reasons: ['nothing was drawn'], guideCovered: 0, lineCovered: 0, km: 0 };
  const guideCovered = coverage(densify(guide, 15), line);
  const lineCovered = coverage(densify(line, 15), guide);
  const km = lineMeters(line) / 1000;
  const reasons = [];
  if (guideCovered < MIN_COVER) reasons.push(`only ${Math.round(guideCovered * 100)}% of the guide is within ${COVER_M} m of the line`);
  if (lineCovered < MIN_COVER) reasons.push(`only ${Math.round(lineCovered * 100)}% of the line is within ${COVER_M} m of the guide`);
  if (Number.isFinite(officialKm) && officialKm > 0) {
    const off = Math.abs(km - officialKm) / officialKm;
    if (off > MAX_LENGTH_OFF) reasons.push(`the line is ${km.toFixed(2)} km against ${officialKm} km published (${Math.round(off * 100)}% apart)`);
  } else {
    reasons.push('no published distance to compare the line with');
  }
  return { keep: !reasons.length, reasons, guideCovered, lineCovered, km };
}

function tilesFor(line) {
  const lats = line.map(p => p[0]), lngs = line.map(p => p[1]);
  const pad = 0.002;
  const south = Math.min(...lats) - pad, north = Math.max(...lats) + pad;
  const west = Math.min(...lngs) - pad, east = Math.max(...lngs) + pad;
  const tiles = [];
  for (let lat = south; lat < north; lat += TILE_DEG) {
    for (let lng = west; lng < east; lng += TILE_DEG) {
      tiles.push([lng, lat, Math.min(lng + TILE_DEG, east), Math.min(lat + TILE_DEG, north)]);
    }
  }
  return tiles;
}

function parseArgs(argv) {
  const out = { apply: false };
  const keys = ['id', 'name', 'operator', 'source', 'guide', 'km', 'ascent', 'time'];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    if (arg === '--apply') { out.apply = true; continue; }
    const match = arg.match(/^--([a-z]+)(?:=(.*))?$/);
    if (match && keys.includes(match[1])) out[match[1]] = match[2] !== undefined ? match[2] : argv[i += 1];
  }
  if (out.km !== undefined) out.km = Number(out.km);
  if (out.ascent !== undefined) out.ascent = Number(out.ascent);
  return out;
}

const fetchText = async url => {
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
};
const fetchJson = async url => JSON.parse(await fetchText(url));

async function main(options = {}) {
  const args = parseArgs(options.argv || process.argv.slice(2));
  const say = options.log || console.log;
  const missing = ['id', 'name', 'operator', 'source', 'guide', 'km', 'ascent', 'time'].filter(key => args[key] === undefined || args[key] === '' || Number.isNaN(args[key]));
  if (missing.length) { say(`[board-line] Missing ${missing.map(k => `--${k}`).join(', ')}. Nothing was changed.`); return null; }
  if (!/^[a-z]+-[a-z0-9-]+$/.test(args.id) || args.id.startsWith('osm-')) {
    say('[board-line] --id must be <area>-<slug> and must not start with osm-. Nothing was changed.');
    return null;
  }
  if (!/^\d{1,2}:\d{2}$/.test(String(args.time))) { say('[board-line] --time must be h:mm as the operator publishes it. Nothing was changed.'); return null; }
  for (const url of [args.source, args.guide]) {
    if (!/^https:\/\//.test(url)) { say(`[board-line] ${url} is not an https page. Nothing was changed.`); return null; }
  }

  const target = options.routesPath || path.join(ROOT, ROUTES_FILE);
  let collection;
  try { collection = JSON.parse(await fs.readFile(target, 'utf8')); }
  catch { collection = { type: 'FeatureCollection', features: [] }; }
  if (collection.features.some(feature => feature.properties?.trail_id === args.id)) {
    say(`[board-line] ${args.id} is already in ${ROUTES_FILE}. Nothing was changed.`);
    return { status: 'already-present' };
  }

  const getText = options.fetchText || fetchText;
  const getJson = options.fetchJson || fetchJson;
  const guide = parseGuide(await getText(args.guide));
  if (!guide) { say(`[board-line] ${args.guide} carries no published line. Nothing was changed.`); return { status: 'no-guide' }; }

  const answers = [];
  for (const [w, s, e, n] of tilesFor(guide.line)) {
    answers.push(await getJson(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${w.toFixed(5)},${s.toFixed(5)},${e.toFixed(5)},${n.toFixed(5)}`));
    if (options.pauseMs !== 0) await new Promise(resolve => setTimeout(resolve, options.pauseMs || 1000));
  }
  const graph = buildGraph(answers);
  const drawn = matchGuide(graph, guide.line);
  if (drawn.refused) {
    say(`[board-line] ${args.name} is not drawable: ${drawn.refused}. Nothing was changed.`);
    return { status: 'refused', reasons: [drawn.refused] };
  }
  const verdict = judge(guide.line, drawn.line, args.km);
  const loop = meters(drawn.line[0], drawn.line[drawn.line.length - 1]) <= LOOP_CLOSE_M;
  say(`[board-line] ${args.name}: ${verdict.km.toFixed(2)} km on ${drawn.ways.length} OSM ways, ${loop ? 'a loop' : 'point to point'}; `
    + `published ${args.km} km, ${args.ascent} m up, ${args.time} h.`);
  say(`[board-line]   guide on the line ${Math.round(verdict.guideCovered * 100)}%, line on the guide ${Math.round(verdict.lineCovered * 100)}%.`);
  if (!verdict.keep) {
    for (const reason of verdict.reasons) say(`[board-line]   refused: ${reason}`);
    say('[board-line] Nothing was changed.');
    return { status: 'refused', reasons: verdict.reasons, verdict };
  }

  const round = p => [Math.round(p[1] * 1e6) / 1e6, Math.round(p[0] * 1e6) / 1e6];
  const feature = {
    type: 'Feature',
    properties: {
      trail_id: args.id,
      name: args.name,
      operator: args.operator,
      source_url: args.source,
      official: { distance_km: args.km, ascent_m: args.ascent, time: args.time },
      guide_url: args.guide,
      start_name: guide.start?.name || null,
      line_basis: 'OSM ways along the line the operator publishes; the published line itself is not stored',
      osm_ways: drawn.ways,
      distance_km: Math.round(verdict.km * 10) / 10,
      surfaces: Object.keys(drawn.surfaces).length ? drawn.surfaces : null,
      loop,
      guide_coverage: Math.round(verdict.guideCovered * 1000) / 1000,
      line_coverage: Math.round(verdict.lineCovered * 1000) / 1000,
    },
    geometry: { type: 'LineString', coordinates: drawn.line.map(round) },
  };
  if (!args.apply) {
    say(`[board-line] Dry run. It would join ${ROUTES_FILE} as ${args.id}. Re-run with --apply, then \`node scripts/promote-osm-trails.js --region board\`.`);
    return { status: 'dry-run', feature, verdict };
  }
  collection.features.push(feature);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(collection, null, 1)}\n`, 'utf8');
  say(`[board-line] Added ${args.id} to ${ROUTES_FILE}. Run \`node scripts/promote-osm-trails.js --region board\` to give it a record.`);
  return { status: 'added', feature, verdict };
}

if (require.main === module) {
  main().catch(error => { console.error(`[board-line] ${error.stack || error.message}`); process.exitCode = 1; });
}

module.exports = {
  ROUTES_FILE, SAMPLE_M, SNAP_M, COVER_M, MIN_COVER, MAX_LENGTH_OFF,
  meters, densify, coverage, parseGuide, buildGraph, matchGuide, judge, tilesFor, parseArgs, main,
};
