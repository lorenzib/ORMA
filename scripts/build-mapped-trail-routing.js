#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./load-production-trails');
const { buildCanonicalCatalog } = require('./trail-adapter');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'routing-graphs');
const DEFAULT_BUFFER_KM = 5;
const DEFAULT_DELAY_MS = 2500;
const TRAIL_SNAP_M = 30;
const MAX_TILE_LAT_SPAN = 0.03;
const MAX_TILE_LNG_SPAN = 0.04;
const ALLOWED_HIGHWAYS = new Set([
  'footway', 'path', 'pedestrian', 'track', 'steps',
  'service', 'residential', 'living_street', 'unclassified',
]);
const BLOCKED_ACCESS = new Set(['no', 'private']);
const BLOCKED_SAC_SCALE = new Set([
  'demanding_mountain_hiking', 'alpine_hiking',
  'demanding_alpine_hiking', 'difficult_alpine_hiking',
]);
const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
    ];

function finitePath(pathValue){
  return Array.isArray(pathValue) && pathValue.length >= 2 &&
    pathValue.every(point => Array.isArray(point) && point.length >= 2 &&
      Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

function routeBounds(route, bufferKm = DEFAULT_BUFFER_KM){
  if(!finitePath(route)) throw new Error('A route needs at least two valid coordinates.');
  const lats = route.map(point => point[0]);
  const lngs = route.map(point => point[1]);
  const middleLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const latBuffer = bufferKm / 111.32;
  const lngBuffer = bufferKm / (111.32 * Math.max(0.1, Math.cos(middleLat * Math.PI / 180)));
  return {
    south:Math.max(-90, Math.min(...lats) - latBuffer),
    west:Math.max(-180, Math.min(...lngs) - lngBuffer),
    north:Math.min(90, Math.max(...lats) + latBuffer),
    east:Math.min(180, Math.max(...lngs) + lngBuffer),
  };
}

function rounded(value, places = 6){
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function bboxString(bounds){
  return [bounds.south, bounds.west, bounds.north, bounds.east]
    .map(value => rounded(value, 6))
    .join(',');
}

function overpassQuery(bounds){
  const bbox = bboxString(bounds);
  return [
    '[out:json][timeout:240];',
    '(',
    `  way["highway"~"^(footway|path|pedestrian|track|steps|service|residential|living_street|unclassified)$"](${bbox});`,
    ');',
    '(._;>;);',
    'out body qt;',
  ].join('\n');
}

function splitBounds(bounds, maxLatSpan = MAX_TILE_LAT_SPAN, maxLngSpan = MAX_TILE_LNG_SPAN){
  const latParts = Math.max(1, Math.ceil(((bounds.north - bounds.south) / maxLatSpan) - 1e-9));
  const lngParts = Math.max(1, Math.ceil(((bounds.east - bounds.west) / maxLngSpan) - 1e-9));
  const tiles = [];
  for(let latIndex = 0; latIndex < latParts; latIndex += 1){
    for(let lngIndex = 0; lngIndex < lngParts; lngIndex += 1){
      tiles.push({
        south:bounds.south + ((bounds.north - bounds.south) * latIndex / latParts),
        west:bounds.west + ((bounds.east - bounds.west) * lngIndex / lngParts),
        north:bounds.south + ((bounds.north - bounds.south) * (latIndex + 1) / latParts),
        east:bounds.west + ((bounds.east - bounds.west) * (lngIndex + 1) / lngParts),
      });
    }
  }
  return tiles;
}

function metres(first, second){
  const scale = 111000;
  const dLat = (second.lat - first.lat) * scale;
  const dLng = (second.lng - first.lng) * scale *
    Math.cos(((first.lat + second.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

function nearestSegmentDistance(point, route){
  let nearest = Infinity;
  const latScale = 111000;
  const lngScale = latScale * Math.cos(point.lat * Math.PI / 180);
  for(let index = 0; index < route.length - 1; index += 1){
    const start = { x:(route[index][1] - point.lng) * lngScale, y:(route[index][0] - point.lat) * latScale };
    const end = { x:(route[index + 1][1] - point.lng) * lngScale, y:(route[index + 1][0] - point.lat) * latScale };
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX ** 2 + deltaY ** 2;
    const fraction = lengthSquared
      ? Math.max(0, Math.min(1, -((start.x * deltaX) + (start.y * deltaY)) / lengthSquared))
      : 0;
    nearest = Math.min(nearest, Math.hypot(start.x + deltaX * fraction, start.y + deltaY * fraction));
  }
  return nearest;
}

function walkable(way, nodes){
  const tags = way.tags || {};
  if(!ALLOWED_HIGHWAYS.has(tags.highway)) return false;
  if(BLOCKED_ACCESS.has(tags.access) || BLOCKED_ACCESS.has(tags.foot) || tags.dog === 'no') return false;
  if(BLOCKED_SAC_SCALE.has(tags.sac_scale)) return false;
  return !(way.nodes || []).some(nodeId => {
    const node = nodes.get(nodeId);
    return node && node.tags && node.tags.barrier &&
      (BLOCKED_ACCESS.has(node.tags.access) || BLOCKED_ACCESS.has(node.tags.foot));
  });
}

class MinQueue {
  constructor(){ this.items = []; }
  get length(){ return this.items.length; }
  push(item){
    this.items.push(item);
    let index = this.items.length - 1;
    while(index > 0){
      const parent = Math.floor((index - 1) / 2);
      if(this.items[parent][0] <= item[0]) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  shift(){
    if(!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if(this.items.length){
      let index = 0;
      while(true){
        const left = index * 2 + 1;
        const right = left + 1;
        if(left >= this.items.length) break;
        const child = right < this.items.length && this.items[right][0] < this.items[left][0]
          ? right
          : left;
        if(this.items[child][0] >= last[0]) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function reachableFromTargets(nodeCount, edges, targets, maxDistanceM){
  const adjacency = Array.from({ length:nodeCount }, () => []);
  edges.forEach(edge => {
    adjacency[edge[0]].push([edge[1], edge[2]]);
    adjacency[edge[1]].push([edge[0], edge[2]]);
  });
  const distances = Array(nodeCount).fill(Infinity);
  const queue = new MinQueue();
  targets.forEach(target => {
    distances[target] = 0;
    queue.push([0, target]);
  });
  while(queue.length){
    const [distance, node] = queue.shift();
    if(distance !== distances[node]) continue;
    if(distance > maxDistanceM) break;
    adjacency[node].forEach(([next, cost]) => {
      const candidate = distance + cost;
      if(candidate > maxDistanceM || candidate >= distances[next]) return;
      distances[next] = candidate;
      queue.push([candidate, next]);
    });
  }
  return new Set(distances.map((distance, index) => distance <= maxDistanceM ? index : -1).filter(index => index >= 0));
}

function buildGraph(trail, osm, options = {}){
  if(!trail || !finitePath(trail.path)) throw new Error('Trail geometry is unavailable.');
  const elements = Array.isArray(osm && osm.elements) ? osm.elements : [];
  const nodes = new Map(elements
    .filter(element => element.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon))
    .map(element => [element.id, element]));
  const edgeRows = [];
  const usedIds = new Set();
  const edgeKeys = new Set();
  elements.filter(element => element.type === 'way' && Array.isArray(element.nodes))
    .filter(way => walkable(way, nodes))
    .forEach(way => {
      for(let index = 0; index < way.nodes.length - 1; index += 1){
        const from = nodes.get(way.nodes[index]);
        const to = nodes.get(way.nodes[index + 1]);
        if(!from || !to) continue;
        const distance = metres(
          { lat:from.lat, lng:from.lon },
          { lat:to.lat, lng:to.lon }
        );
        if(!Number.isFinite(distance) || distance <= 0) continue;
        const roundedDistance = rounded(distance, 1);
        if(roundedDistance <= 0) continue;
        const key = from.id < to.id ? `${from.id}:${to.id}` : `${to.id}:${from.id}`;
        if(edgeKeys.has(key)) continue;
        edgeKeys.add(key);
        usedIds.add(from.id);
        usedIds.add(to.id);
        edgeRows.push([from.id, to.id, roundedDistance, way.tags.highway]);
      }
    });
  const ids = [...usedIds].sort((first, second) => Number(first) - Number(second));
  const indexes = new Map(ids.map((id, index) => [id, index]));
  const graphNodes = ids.map(id => {
    const node = nodes.get(id);
    return [rounded(node.lon), rounded(node.lat)];
  });
  const edges = edgeRows.map(edge => [indexes.get(edge[0]), indexes.get(edge[1]), edge[2], edge[3]]);
  const snapM = Number.isFinite(options.trailSnapM) ? options.trailSnapM : TRAIL_SNAP_M;
  const trailNodes = ids
    .map((id, index) => {
      const node = nodes.get(id);
      return { index, point:{ lat:node.lat, lng:node.lon } };
    })
    .filter(item => nearestSegmentDistance(item.point, trail.path) <= snapM)
    .map(item => item.index);
  if(!edges.length) throw new Error('No eligible mapped walking edges were found.');
  if(!trailNodes.length) throw new Error(`No mapped walking node is within ${snapM} m of the trail.`);

  const maxApproachM = Math.round((options.bufferKm || DEFAULT_BUFFER_KM) * 1000);
  const reachable = reachableFromTargets(graphNodes.length, edges, trailNodes, maxApproachM);
  const keptIndexes = [...reachable].sort((first, second) => first - second);
  const remap = new Map(keptIndexes.map((oldIndex, newIndex) => [oldIndex, newIndex]));
  const keptNodes = keptIndexes.map(index => graphNodes[index]);
  const keptEdges = edges
    .filter(edge => reachable.has(edge[0]) && reachable.has(edge[1]))
    .map(edge => [remap.get(edge[0]), remap.get(edge[1]), edge[2]]);
  const keptTargets = trailNodes.filter(index => reachable.has(index)).map(index => remap.get(index));
  if(!keptEdges.length || !keptTargets.length) throw new Error('No connected routing graph reached the trail.');

  return {
    schemaVersion:1,
    trailId:trail.id,
    source:'OpenStreetMap walking network retrieved via Overpass',
    attribution:'© OpenStreetMap contributors · ODbL',
    licenceUrl:'https://www.openstreetmap.org/copyright',
    retrievedAt:options.retrievedAt || new Date().toISOString(),
    bounds:options.bounds || routeBounds(trail.path, options.bufferKm),
    restrictions:{
      excludes:['access=no', 'access=private', 'foot=no', 'foot=private', 'dog=no', 'demanding/alpine SAC scales'],
      trailSnapM:snapM,
      maxApproachM,
    },
    nodes:keptNodes,
    edges:keptEdges,
    trailNodes:keptTargets,
  };
}

async function fetchOverpass(query){
  let lastError = null;
  for(let endpointIndex = 0; endpointIndex < OVERPASS_URLS.length; endpointIndex += 1){
    const endpoint = OVERPASS_URLS[endpointIndex];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try{
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{
          'Content-Type':'application/x-www-form-urlencoded',
          'User-Agent':'ORMA/1.0 (https://www.app-orma.com; mapped trail access builder)',
        },
        body:`data=${encodeURIComponent(query)}`,
        signal:controller.signal,
      });
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }catch(error){
      lastError = error;
    }finally{
      clearTimeout(timeout);
    }
  }
  throw new Error(`All Overpass mirrors failed: ${lastError ? lastError.message : 'unknown error'}`);
}

async function fetchBounds(bounds){
  const tiles = splitBounds(bounds);
  const elements = new Map();
  for(let index = 0; index < tiles.length; index += 1){
    const osm = await fetchOverpass(overpassQuery(tiles[index]));
    (osm.elements || []).forEach(element => elements.set(`${element.type}/${element.id}`, element));
    if(index < tiles.length - 1) await new Promise(resolve => setTimeout(resolve, 700));
  }
  return { elements:[...elements.values()] };
}

function parseArguments(argv){
  const result = {
    all:false,
    funes:false,
    resume:false,
    trailIds:[],
    bufferKm:DEFAULT_BUFFER_KM,
    delayMs:DEFAULT_DELAY_MS,
    limit:Infinity,
  };
  argv.forEach(argument => {
    if(argument === '--all') result.all = true;
    else if(argument === '--funes') result.funes = true;
    else if(argument === '--resume') result.resume = true;
    else if(argument.startsWith('--trail=')) result.trailIds.push(...argument.slice(8).split(',').filter(Boolean));
    else if(argument.startsWith('--buffer-km=')) result.bufferKm = Number(argument.slice(12));
    else if(argument.startsWith('--delay-ms=')) result.delayMs = Number(argument.slice(11));
    else if(argument.startsWith('--limit=')) result.limit = Number(argument.slice(8));
  });
  if(!result.all && !result.funes && !result.trailIds.length){
    throw new Error('Choose --funes, --all, or --trail=<trail-id>.');
  }
  if(!Number.isFinite(result.bufferKm) || result.bufferKm <= 0 || result.bufferKm > 5){
    throw new Error('--buffer-km must be greater than 0 and no more than 5.');
  }
  return result;
}

function selectedTrails(trails, options){
  const requested = new Set(options.trailIds);
  return trails.filter(trail => {
    if(options.all) return true;
    if(requested.has(trail.id)) return true;
    return options.funes && /val di funes|villn[öo]ss|odle|geisler/i.test(`${trail.name} ${trail.area}`);
  }).slice(0, options.limit);
}

async function main(){
  const options = parseArguments(process.argv.slice(2));
  const sourceTrails = loadProductionTrails(ROOT);
  const publishedIds = new Set(
    buildCanonicalCatalog(sourceTrails).records
      .filter(record => record.lifecycle === 'published')
      .map(record => record.id)
  );
  const trails = selectedTrails(
    sourceTrails.filter(trail => publishedIds.has(trail.id)),
    options
  );
  if(!trails.length) throw new Error('No matching published trails were found.');
  fs.mkdirSync(OUTPUT_DIR, { recursive:true });
  const failures = [];
  let built = 0;
  let skipped = 0;
  for(let index = 0; index < trails.length; index += 1){
    const trail = trails[index];
    const outputPath = path.join(OUTPUT_DIR, `${trail.id}.json`);
    const offlineGraphPath = path.join(ROOT, 'offline', 'packages', trail.id, 'footpath-network.json');
    if(options.resume && (fs.existsSync(outputPath) || fs.existsSync(offlineGraphPath))){
      skipped += 1;
      console.log(`[${index + 1}/${trails.length}] ${trail.id}: already present`);
      continue;
    }
    try{
      const bounds = routeBounds(trail.path, options.bufferKm);
      console.log(`[${index + 1}/${trails.length}] ${trail.id}: fetching ${bboxString(bounds)}`);
      const tiles = splitBounds(bounds);
      if(tiles.length > 1) console.log(`  splitting dense corridor into ${tiles.length} map tiles`);
      const osm = await fetchBounds(bounds);
      const graph = buildGraph(trail, osm, { bounds, bufferKm:options.bufferKm });
      fs.writeFileSync(outputPath, `${JSON.stringify(graph)}\n`);
      built += 1;
      console.log(`  built ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.trailNodes.length} trail targets`);
    }catch(error){
      failures.push({ trailId:trail.id, message:error.message });
      console.warn(`  failed: ${error.message}`);
    }
    if(index < trails.length - 1 && options.delayMs > 0){
      await new Promise(resolve => setTimeout(resolve, options.delayMs));
    }
  }
  console.log(JSON.stringify({ selected:trails.length, built, skipped, failed:failures.length, failures }, null, 2));
  if(failures.length) process.exitCode = 2;
}

if(require.main === module){
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ALLOWED_HIGHWAYS,
  BLOCKED_ACCESS,
  BLOCKED_SAC_SCALE,
  buildGraph,
  finitePath,
  overpassQuery,
  parseArguments,
  routeBounds,
  selectedTrails,
  splitBounds,
};
