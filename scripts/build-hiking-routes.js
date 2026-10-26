#!/usr/bin/env node
'use strict';

/**
 * The hiking network, drawn by us instead of Waymarked Trails' raster.
 *
 * Waymarked's tiles are finished pictures in their own colours (red, yellow,
 * purple by network), so they cannot be restyled to sit quietly under a walk.
 * This reads the same OpenStreetMap route relations they draw and writes one
 * GeoJSON feature per route -- its number, name and network -- for tippecanoe
 * to pack into vector tiles we style ourselves.
 *
 * Input is osmium's OPL text, after the build server has cut the region out
 * of a Geofabrik extract, kept the hiking relations and put coordinates on
 * their ways (see .github/workflows/orma-hiking-route-tiles.yml):
 *
 *   node scripts/build-hiking-routes.js routes.opl routes.geojsonseq
 *
 * OPL is used rather than a PBF library so this stays plain Node with no new
 * dependency; the build server's own `osmium` does the binary reading.
 */

const fs = require('fs');
const readline = require('readline');

// Waymarked's order: international, national, regional, then local. A walk's
// own routes are ranked above all of these when the map draws labels.
const NETWORK_RANK = { iwn: 1, nwn: 2, rwn: 3, lwn: 4 };

// Padded around each region's mapped trails (the trail bounds, measured
// 26 Oct 2026, plus ~0.1 degrees) so routes leaving the edge walks still draw.
const REGIONS = {
  dolomites: { bbox: [10.83, 45.96, 12.66, 47.03] },
  savoy: { bbox: [5.65, 45.06, 7.05, 46.45] },
};

// OPL escapes awkward characters as %<hex codepoint>%.
function unescapeOpl(text){
  return text.replace(/%([0-9a-fA-F]+)%/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function parseTags(field){
  const tags = {};
  if(!field) return tags;
  for(const pair of field.split(',')){
    const at = pair.indexOf('=');
    if(at < 0) continue;
    tags[unescapeOpl(pair.slice(0, at))] = unescapeOpl(pair.slice(at + 1));
  }
  return tags;
}

// A located way's nodes read `n12x11.1234567y46.7654321`.
function parseWayNodes(field){
  if(!field) return [];
  return field.split(',').map(entry => {
    const match = /^n(-?\d+)x(-?[\d.]+)y(-?[\d.]+)$/.exec(entry);
    return match ? { id: match[1], lon: Number(match[2]), lat: Number(match[3]) } : null;
  });
}

function parseMembers(field){
  if(!field) return [];
  return field.split(',').map(entry => {
    const at = entry.indexOf('@');
    return { type: entry[0], ref: entry.slice(1, at), role: unescapeOpl(entry.slice(at + 1)) };
  });
}

function parseLine(line){
  const fields = {};
  const parts = line.split(' ');
  for(const part of parts.slice(1)) fields[part[0]] = part.slice(1);
  return { type: parts[0][0], id: parts[0].slice(1), fields };
}

// Join a route's ways end to end where they share a node, so a number has a
// line long enough to sit on instead of one fragment per way.
function mergeWays(ways){
  const unused = new Set(ways.keys());
  const byEnd = new Map();
  ways.forEach((nodes, index) => {
    for(const node of [nodes[0], nodes[nodes.length - 1]]){
      if(!byEnd.has(node.id)) byEnd.set(node.id, []);
      byEnd.get(node.id).push(index);
    }
  });
  const take = endId => {
    const next = (byEnd.get(endId) || []).find(index => unused.has(index));
    if(next === undefined) return null;
    unused.delete(next);
    const nodes = ways[next];
    return nodes[0].id === endId ? nodes : nodes.slice().reverse();
  };
  const lines = [];
  for(const start of ways.keys()){
    if(!unused.has(start)) continue;
    unused.delete(start);
    let chain = ways[start].slice();
    for(let piece = take(chain[chain.length - 1].id); piece; piece = take(chain[chain.length - 1].id)){
      chain = chain.concat(piece.slice(1));
    }
    for(let piece = take(chain[0].id); piece; piece = take(chain[0].id)){
      chain = piece.slice().reverse().concat(chain.slice(1));
    }
    lines.push(chain);
  }
  return lines;
}

const round = value => Math.round(value * 1e6) / 1e6;

function routeFeature(relationId, tags, ways){
  if(!ways.length) return null;
  const lines = mergeWays(ways).map(nodes => nodes.map(node => [round(node.lon), round(node.lat)]));
  return {
    type: 'Feature',
    id: Number(relationId),
    properties: {
      id: Number(relationId),
      ref: tags.ref || '',
      name: tags.name || '',
      network: tags.network || '',
      rank: NETWORK_RANK[tags.network] || 5,
    },
    geometry: lines.length === 1
      ? { type: 'LineString', coordinates: lines[0] }
      : { type: 'MultiLineString', coordinates: lines },
  };
}

const isHikingRoute = tags => tags.type === 'route' && (tags.route === 'hiking' || tags.route === 'foot')
  && !['proposed', 'disused', 'abandoned'].includes(tags.state);

/**
 * Reads OPL lines and yields one feature per hiking route. Ways must come
 * before relations, which is the order osmium writes them in.
 */
async function* routesFromOpl(lines){
  const ways = new Map();
  for await (const line of lines){
    if(!line) continue;
    const item = parseLine(line);
    if(item.type === 'w'){
      const nodes = parseWayNodes(item.fields.N);
      // A node outside the extract has no location; that way is unusable.
      if(nodes.length >= 2 && nodes.every(Boolean)) ways.set(item.id, nodes);
    } else if(item.type === 'r'){
      const tags = parseTags(item.fields.T);
      if(!isHikingRoute(tags)) continue;
      // Child relations of a superroute draw themselves.
      const members = parseMembers(item.fields.M).filter(member => member.type === 'w' && ways.has(member.ref));
      const feature = routeFeature(item.id, tags, members.map(member => ways.get(member.ref)));
      if(feature) yield feature;
    }
  }
}

async function main(){
  const [input, output] = process.argv.slice(2);
  if(!input || !output){
    console.error('Usage: node scripts/build-hiking-routes.js <routes.opl> <routes.geojsonseq>');
    process.exit(2);
  }
  const lines = readline.createInterface({ input: fs.createReadStream(input), crlfDelay: Infinity });
  const out = fs.createWriteStream(output);
  let routes = 0;
  let numbered = 0;
  for await (const feature of routesFromOpl(lines)){
    routes += 1;
    if(feature.properties.ref) numbered += 1;
    if(!out.write(`${JSON.stringify(feature)}\n`)) await new Promise(resolve => out.once('drain', resolve));
  }
  await new Promise(resolve => out.end(resolve));
  console.log(JSON.stringify({ routes, numbered }));
}

if(require.main === module){
  main().catch(error => { console.error(error); process.exit(1); });
}

module.exports = { REGIONS, NETWORK_RANK, unescapeOpl, parseTags, mergeWays, routesFromOpl };
