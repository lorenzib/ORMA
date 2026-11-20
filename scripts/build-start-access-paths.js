#!/usr/bin/env node
'use strict';

// The walk-in: from a walk's start flag (car park, bus stop, lift station) to
// the nearest point of its line, along mapped footways, paths, tracks and
// quiet lanes (OpenStreetMap). Written to data/start-access-paths.json and
// drawn on the maps as a thin dashed line. It never changes the walk's own
// distance, climb or time.
//
//   node scripts/build-start-access-paths.js            every walk over the threshold
//   node scripts/build-start-access-paths.js --trail=a,b only these
//
// A walk whose walk-in is longer than MAX_LENGTH_M, or that the mapped network
// cannot connect, is not drawn: it goes to the reviewed exceptions in the same
// file with a reason, for the owner.

const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./load-production-trails');
const { ALLOWED_HIGHWAYS, BLOCKED_ACCESS, BLOCKED_SAC_SCALE } = require('./build-mapped-trail-routing');
const {
  DATA_FILE, THRESHOLD_M, MAX_LENGTH_M, metres, nearestOnLine, lineLength,
} = require('./start-access-paths');

const ROOT = path.resolve(__dirname, '..');
const SEARCH_RADIUS_M = MAX_LENGTH_M + 300;
// The start flag sits on a car park or a stop, not always on a mapped way:
// this far it may step straight onto the nearest one.
const START_SNAP_M = 80;
// A mapped node this close to the walk's line is on the walk.
const JOIN_M = 15;
// Lanes and service roads count a little longer than paths, so a parallel
// footway wins when it is nearly as short.
// Village through-roads (tertiary, secondary) are allowed for short
// stretches, at two and a half times their length, so a start flag on a main
// street can reach a walk a few steps along it, but a path wins wherever one
// runs nearly as short. Main roads (primary, trunk) never count.
const ROAD_FACTOR = { residential:1.25, unclassified:1.25, service:1.15, living_street:1.1, tertiary:2.5, secondary:2.5 };
const HIGHWAYS = new Set([...ALLOWED_HIGHWAYS, 'tertiary', 'secondary']);
// Join the walk at its km 0 (where its directions and figures start) when that
// is no more than this much further than its nearest point.
const KM0_SLACK = { factor:1.25, metres:60 };
const KM0_ALONG_M = 60;
// A walk-in this much longer than the straight gap goes the long way round
// (no mapped path down a slope, a river between): not drawn, the owner checks.
function detourLimitM(gapM){ return Math.max(gapM * 3, gapM + 150); }
const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

function walkable(way, nodes){
  const tags = way.tags || {};
  if(!HIGHWAYS.has(tags.highway)) return false;
  if(BLOCKED_ACCESS.has(tags.access) && !['yes', 'designated', 'permissive'].includes(tags.foot)) return false;
  if(BLOCKED_ACCESS.has(tags.foot) || tags.dog === 'no') return false;
  if(BLOCKED_SAC_SCALE.has(tags.sac_scale)) return false;
  return !(way.nodes || []).some(id => {
    const node = nodes.get(id);
    return node && node.tags && node.tags.barrier &&
      (BLOCKED_ACCESS.has(node.tags.access) || BLOCKED_ACCESS.has(node.tags.foot));
  });
}

async function fetchOverpass(query){
  let lastError = null;
  for(let attempt = 0; attempt < OVERPASS_URLS.length * 3; attempt += 1){
    const endpoint = OVERPASS_URLS[attempt % OVERPASS_URLS.length];
    try{
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'User-Agent':'ORMA/1.0 (https://www.app-orma.com; start access builder)' },
        body:`data=${encodeURIComponent(query)}`,
        signal:AbortSignal.timeout(120000),
      });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }catch(error){
      lastError = error;
      console.error(`  ${endpoint}: ${error.message}, retrying`);
      await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
    }
  }
  throw new Error(`Overpass failed: ${lastError && lastError.message}`);
}

// The OSM editing API's map call: every way in a small box with all its
// nodes, the same element shape as Overpass. Quick when Overpass is busy. A box
// with too many nodes is split in four.
async function fetchOsmApi(start, radiusM = SEARCH_RADIUS_M){
  const dLat = radiusM / 111320;
  const dLng = dLat / Math.cos(start.lat * Math.PI / 180);
  const boxes = [[start.lat - dLat, start.lng - dLng, start.lat + dLat, start.lng + dLng]];
  const elements = new Map();
  while(boxes.length){
    const [south, west, north, east] = boxes.shift();
    const bbox = [west, south, east, north].map(v => v.toFixed(6)).join(',');
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {
      headers:{ 'User-Agent':'ORMA/1.0 (https://www.app-orma.com; start access builder)' },
      signal:AbortSignal.timeout(120000),
    });
    if(response.status === 400){
      const midLat = (south + north) / 2;
      const midLng = (west + east) / 2;
      boxes.push([south, west, midLat, midLng], [south, midLng, midLat, east], [midLat, west, north, midLng], [midLat, midLng, north, east]);
      continue;
    }
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    (json.elements || []).forEach(el => {
      if(el.type === 'relation') return;
      if(el.type === 'way' && !(el.tags && el.tags.highway)) return;
      elements.set(`${el.type}/${el.id}`, el);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return { elements:[...elements.values()] };
}

function queryAround(start){
  const dLat = SEARCH_RADIUS_M / 111320;
  const dLng = dLat / Math.cos(start.lat * Math.PI / 180);
  const bbox = [start.lat - dLat, start.lng - dLng, start.lat + dLat, start.lng + dLng].map(v => v.toFixed(6)).join(',');
  return `[out:json][timeout:90];(way["highway"~"^(${[...HIGHWAYS].join('|')})$"](${bbox}););(._;>;);out body qt;`;
}

class MinQueue {
  constructor(){ this.items = []; }
  get length(){ return this.items.length; }
  push(item){
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while(i > 0){
      const parent = (i - 1) >> 1;
      if(items[parent][0] <= item[0]) break;
      items[i] = items[parent];
      i = parent;
    }
    items[i] = item;
  }
  shift(){
    const items = this.items;
    const first = items[0];
    const last = items.pop();
    if(items.length){
      let i = 0;
      for(;;){
        const left = i * 2 + 1;
        if(left >= items.length) break;
        const child = left + 1 < items.length && items[left + 1][0] < items[left][0] ? left + 1 : left;
        if(items[child][0] >= last[0]) break;
        items[i] = items[child];
        i = child;
      }
      items[i] = last;
    }
    return first;
  }
}

// Shortest walk-in from the start to the line, or the reason there is none.
function routeAccess(trail, osm, options = {}){
  const maxM = options.maxLengthM || MAX_LENGTH_M;
  const start = { lat:trail.startPoint.lat, lng:trail.startPoint.lng };
  const nodes = new Map();
  (osm.elements || []).forEach(el => { if(el.type === 'node') nodes.set(el.id, el); });
  const adjacency = new Map();
  // Long mapped segments are cut into ~10 m steps, so a way that passes the
  // line between two of its nodes still meets it.
  const extra = new Map();
  const point = id => {
    if(extra.has(id)) return extra.get(id);
    const n = nodes.get(id);
    return { lat:n.lat, lng:n.lon };
  };
  const link = (a, b, cost, length) => {
    if(!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a).push([b, cost, length]);
  };
  const segments = [];
  (osm.elements || []).filter(el => el.type === 'way' && walkable(el, nodes)).forEach(way => {
    const factor = ROAD_FACTOR[way.tags.highway] || 1;
    for(let i = 0; i < way.nodes.length - 1; i += 1){
      const a = way.nodes[i];
      const b = way.nodes[i + 1];
      if(!nodes.has(a) || !nodes.has(b) || a === b) continue;
      const pa = point(a);
      const pb = point(b);
      const steps = Math.max(1, Math.ceil(metres(pa, pb) / 10));
      let prevId = a;
      for(let k = 1; k <= steps; k += 1){
        let id = b;
        if(k < steps){
          id = `${a}-${b}-${k}`;
          extra.set(id, { lat:pa.lat + (pb.lat - pa.lat) * k / steps, lng:pa.lng + (pb.lng - pa.lng) * k / steps });
        }
        const length = metres(point(prevId), point(id));
        link(prevId, id, length * factor, length);
        link(id, prevId, length * factor, length);
        segments.push([prevId, id, factor]);
        prevId = id;
      }
    }
  });
  // Step from the flag onto the nearest mapped way.
  let snap = null;
  segments.forEach(([a, b, factor]) => {
    const near = nearestOnLine(start, [[point(a).lat, point(a).lng], [point(b).lat, point(b).lng]]);
    if(!snap || near.distanceM < snap.distanceM) snap = { ...near, a, b, factor };
  });
  if(!snap || snap.distanceM > START_SNAP_M){
    return { reason:`no mapped path within ${START_SNAP_M} m of the start` };
  }
  const line = trail.path;
  const onWalk = new Map();
  const onWalkFor = id => {
    if(!onWalk.has(id)) onWalk.set(id, nearestOnLine(point(id), line));
    return onWalk.get(id);
  };
  const START = 'start';
  const SNAP = 'snap';
  const snapPoint = { lat:snap.point[0], lng:snap.point[1] };
  const snapLen = metres(start, snapPoint);
  const lenA = metres(snapPoint, point(snap.a));
  const lenB = metres(snapPoint, point(snap.b));
  const graph = id => {
    if(id === START) return [[SNAP, snapLen, snapLen]];
    if(id === SNAP) return [[snap.a, lenA * snap.factor, lenA], [snap.b, lenB * snap.factor, lenB]];
    return adjacency.get(id) || [];
  };
  const best = new Map([[START, 0]]);
  const prev = new Map();
  const length = new Map([[START, 0]]);
  const queue = new MinQueue();
  queue.push([0, START]);
  const onWalkReached = [];
  while(queue.length){
    const [cost, id] = queue.shift();
    if(cost > best.get(id)) continue;
    if(length.get(id) > maxM * 1.6) break;
    if(id !== START && id !== SNAP && onWalkFor(id).distanceM <= JOIN_M){
      // On the walk: stop here, the walk itself carries on from this point.
      onWalkReached.push(id);
      continue;
    }
    graph(id).forEach(([next, edgeCost, edgeLength]) => {
      const nextCost = cost + edgeCost;
      if(nextCost < (best.has(next) ? best.get(next) : Infinity)){
        best.set(next, nextCost);
        length.set(next, length.get(id) + edgeLength);
        prev.set(next, id);
        queue.push([nextCost, next]);
      }
    });
  }
  if(!onWalkReached.length) return { reason:'the mapped paths around the start do not reach the line' };
  // How far along the walk a join point lies, and whether that is its km 0.
  const along = [0];
  for(let i = 1; i < line.length; i += 1){
    along.push(along[i - 1] + metres({ lat:line[i - 1][0], lng:line[i - 1][1] }, { lat:line[i][0], lng:line[i][1] }));
  }
  const total = along[along.length - 1];
  const isLoop = metres({ lat:line[0][0], lng:line[0][1] }, { lat:line[line.length - 1][0], lng:line[line.length - 1][1] }) < 75;
  const atKm0 = id => {
    const join = onWalkFor(id);
    const at = along[join.index] + metres({ lat:line[join.index][0], lng:line[join.index][1] }, { lat:join.point[0], lng:join.point[1] });
    return at <= KM0_ALONG_M || (isLoop && total - at <= KM0_ALONG_M);
  };
  const byCost = onWalkReached.slice().sort((a, b) => best.get(a) - best.get(b));
  const nearest = byCost[0];
  const km0 = byCost.find(atKm0);
  const gapM = nearestOnLine(start, line).distanceM;
  const fits = id => length.get(id) <= detourLimitM(gapM);
  const km0Close = km0 && best.get(km0) <= Math.max(best.get(nearest) * KM0_SLACK.factor, best.get(nearest) + KM0_SLACK.metres);
  const reached = km0Close && fits(km0) ? km0 : nearest;
  if(!fits(reached)){
    return { reason:`the mapped paths go the long way round: about ${Math.round(length.get(reached))} m on foot for a start ${Math.round(gapM)} m from the line` };
  }
  const ids = [];
  for(let id = reached; id !== undefined; id = prev.get(id)) ids.unshift(id);
  const coords = ids.map(id => {
    if(id === START) return [start.lat, start.lng];
    if(id === SNAP) return snap.point;
    const p = point(id);
    return [p.lat, p.lng];
  });
  const join = onWalkFor(reached);
  if(join.distanceM > 1) coords.push(join.point);
  const keep = ids.map(id => !(typeof id === 'string' && extra.has(id)));
  keep[keep.length - 1] = true;
  const kept = coords.filter((_, i) => i >= ids.length || keep[i]);
  const rounded = kept.map(([lat, lng]) => [Number(lat.toFixed(6)), Number(lng.toFixed(6))])
    .filter((p, i, all) => i === 0 || metres({ lat:p[0], lng:p[1] }, { lat:all[i - 1][0], lng:all[i - 1][1] }) >= 0.5);
  const lengthM = Math.round(lineLength(rounded));
  const joinsAtKm0 = atKm0(reached);
  if(lengthM > maxM) return { reason:`the walk-in is about ${lengthM} m, over the ${maxM} m cap`, lengthM };
  return { path:rounded, lengthM, joinsAtKm0 };
}

// Climb and descent along a walk-in: ground heights from Open-Meteo
// (Copernicus DEM) every ~25 m, counting a change only once it reaches 10 m,
// so DEM noise does not add up.
async function climbOf(line){
  const points = [];
  for(let i = 1; i < line.length; i += 1){
    const a = { lat:line[i - 1][0], lng:line[i - 1][1] };
    const b = { lat:line[i][0], lng:line[i][1] };
    const steps = Math.max(1, Math.ceil(metres(a, b) / 25));
    for(let k = 0; k < steps; k += 1) points.push([a.lat + (b.lat - a.lat) * k / steps, a.lng + (b.lng - a.lng) * k / steps]);
  }
  points.push(line[line.length - 1]);
  const heights = [];
  for(let i = 0; i < points.length; i += 90){
    const chunk = points.slice(i, i + 90);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map(p => p[0].toFixed(6)).join(',')}&longitude=${chunk.map(p => p[1].toFixed(6)).join(',')}`;
    const response = await fetch(url, { headers:{ 'User-Agent':'ORMA/1.0 (https://www.app-orma.com; start access builder)' } });
    if(!response.ok) throw new Error(`Open-Meteo elevation HTTP ${response.status}`);
    heights.push(...(await response.json()).elevation);
  }
  let up = 0;
  let down = 0;
  let ref = heights[0];
  heights.forEach(h => {
    if(h - ref >= 10){ up += h - ref; ref = h; }
    else if(ref - h >= 10){ down += ref - h; ref = h; }
  });
  return { climbM:Math.round(up), descentM:Math.round(down), startElevM:Math.round(heights[0]), joinElevM:Math.round(heights[heights.length - 1]) };
}

function parseArguments(argv){
  const ids = [];
  argv.forEach(arg => { if(arg.startsWith('--trail=')) ids.push(...arg.slice(8).split(',').filter(Boolean)); });
  return { ids };
}

async function main(){
  const { ids } = parseArguments(process.argv.slice(2));
  const dataPath = path.join(ROOT, DATA_FILE);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const trails = loadProductionTrails(ROOT)
    .filter(trail => trail.startPoint && Array.isArray(trail.path) && trail.path.length > 1)
    .filter(trail => ids.length ? ids.includes(trail.id) : nearestOnLine(trail.startPoint, trail.path).distanceM > THRESHOLD_M);
  for(const trail of trails){
    const gapM = Math.round(nearestOnLine(trail.startPoint, trail.path).distanceM);
    // The owner can let one walk's walk-in run over the cap (data.overCap).
    const overCap = (data.overCap || {})[trail.id];
    const maxLengthM = overCap ? overCap.maxLengthM : MAX_LENGTH_M;
    if(gapM > maxLengthM){
      delete data.paths[trail.id];
      if(!data.exceptions[trail.id] || data.exceptions[trail.id].auto){
        data.exceptions[trail.id] = { start:[trail.startPoint.lat, trail.startPoint.lng], gapM, reason:`the start is ${gapM} m from the line, over the ${MAX_LENGTH_M} m cap: a walk of its own`, auto:true };
      }
      console.log(`${trail.id}  gap ${gapM} m  NOT DRAWN: over the cap`);
      continue;
    }
    const cacheFile = path.join(ROOT, '.cache', 'start-access', `${trail.id}.json`);
    let osm;
    if(fs.existsSync(cacheFile)) osm = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    else{
      osm = await fetchOsmApi(trail.startPoint, maxLengthM + 300).catch(error => {
        console.error(`  OSM API: ${error.message}; trying Overpass`);
        return fetchOverpass(queryAround(trail.startPoint));
      });
      fs.mkdirSync(path.dirname(cacheFile), { recursive:true });
      fs.writeFileSync(cacheFile, JSON.stringify(osm));
    }
    const result = routeAccess(trail, osm, { maxLengthM });
    const start = [trail.startPoint.lat, trail.startPoint.lng];
    if(result.path){
      const record = { start, lengthM:result.lengthM, joins:result.joinsAtKm0 ? 'km 0' : 'nearest point', retrievedAt:new Date().toISOString().slice(0, 10), path:result.path };
      // A walk-in long enough to be named under "Where to start" gets its
      // climb measured too, so the line can say how far up it goes.
      if(overCap && overCap.startLine){
        Object.assign(record, await climbOf(result.path), { startLine:true });
      }
      data.paths[trail.id] = record;
      if(data.exceptions[trail.id] && data.exceptions[trail.id].auto) delete data.exceptions[trail.id];
      console.log(`${trail.id}  gap ${gapM} m  walk-in ${result.lengthM} m  joins ${result.joinsAtKm0 ? 'km 0' : 'nearest point'}`);
    }else{
      delete data.paths[trail.id];
      if(!data.exceptions[trail.id] || data.exceptions[trail.id].auto){
        data.exceptions[trail.id] = { start, gapM, reason:result.reason, auto:true };
      }
      console.log(`${trail.id}  gap ${gapM} m  NOT DRAWN: ${result.reason}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  const sorted = obj => Object.fromEntries(Object.keys(obj).sort().map(key => [key, obj[key]]));
  data.paths = sorted(data.paths);
  data.exceptions = sorted(data.exceptions);
  fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`);
}

if(require.main === module){
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { routeAccess, walkable };
