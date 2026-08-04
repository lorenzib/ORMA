#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'data', 'offline-map-sources', 'lago-carezza.osm');
const routePath = path.join(root, 'offline', 'packages', 'lago-carezza', 'route.geojson');
const outputPath = path.join(root, 'offline', 'packages', 'lago-carezza', 'footpath-network.json');
const ALLOWED_HIGHWAYS = new Set([
  'footway', 'path', 'pedestrian', 'track', 'steps',
  'service', 'residential', 'living_street', 'unclassified',
]);
const BLOCKED_ACCESS = new Set(['no', 'private']);
const BLOCKED_SAC_SCALE = new Set([
  'demanding_mountain_hiking', 'alpine_hiking',
  'demanding_alpine_hiking', 'difficult_alpine_hiking',
]);

function decodeXml(value){
  return String(value || '')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function attrs(text){
  const result = {};
  String(text || '').replace(/([\w:-]+)="([^"]*)"/g, (_, key, value) => {
    result[key] = decodeXml(value);
    return '';
  });
  return result;
}

function tags(body){
  const result = {};
  String(body || '').replace(/<tag\b([^>]*?)\/>/g, (_, text) => {
    const tag = attrs(text);
    if(tag.k) result[tag.k] = tag.v || '';
    return '';
  });
  return result;
}

function readOsm(xml){
  const boundsText = xml.match(/<bounds\b([^>]*?)\/>/);
  if(!boundsText) throw new Error('OSM extract has no bounds.');
  const b = attrs(boundsText[1]);
  const bounds = {
    south:Number(b.minlat), west:Number(b.minlon),
    north:Number(b.maxlat), east:Number(b.maxlon),
  };
  const nodes = new Map();
  xml.replace(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g, (_, text, body) => {
    const node = attrs(text);
    nodes.set(node.id, {
      id:node.id, lat:Number(node.lat), lng:Number(node.lon), tags:tags(body),
    });
    return '';
  });
  const ways = [];
  xml.replace(/<way\b([^>]*)>([\s\S]*?)<\/way>/g, (_, text, body) => {
    const way = attrs(text);
    const refs = [];
    body.replace(/<nd\b([^>]*?)\/>/g, (_match, ndText) => {
      refs.push(attrs(ndText).ref);
      return '';
    });
    ways.push({ id:way.id, refs, tags:tags(body) });
    return '';
  });
  return { bounds, nodes, ways };
}

function inBounds(node, bounds){
  return node && node.lat >= bounds.south && node.lat <= bounds.north &&
    node.lng >= bounds.west && node.lng <= bounds.east;
}

function walkable(way, nodes){
  const t = way.tags;
  if(!ALLOWED_HIGHWAYS.has(t.highway)) return false;
  if(BLOCKED_ACCESS.has(t.access) || BLOCKED_ACCESS.has(t.foot) || t.dog === 'no') return false;
  if(BLOCKED_SAC_SCALE.has(t.sac_scale)) return false;
  return !way.refs.some(ref => {
    const node = nodes.get(ref);
    return node && node.tags && node.tags.barrier &&
      (BLOCKED_ACCESS.has(node.tags.access) || BLOCKED_ACCESS.has(node.tags.foot));
  });
}

function metres(a, b){
  const m = 111000;
  const dLat = (b.lat - a.lat) * m;
  const dLng = (b.lng - a.lng) * m *
    Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

function nearestSegmentDistance(point, coordinates){
  let nearest = Infinity;
  const latScale = 111000;
  const lngScale = latScale * Math.cos(point.lat * Math.PI / 180);
  for(let index = 0; index < coordinates.length - 1; index += 1){
    const a = { x:(coordinates[index][0] - point.lng) * lngScale, y:(coordinates[index][1] - point.lat) * latScale };
    const b = { x:(coordinates[index + 1][0] - point.lng) * lngScale, y:(coordinates[index + 1][1] - point.lat) * latScale };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared)) : 0;
    nearest = Math.min(nearest, Math.hypot(a.x + dx * fraction, a.y + dy * fraction));
  }
  return nearest;
}

function build(){
  const { bounds, nodes, ways } = readOsm(fs.readFileSync(sourcePath, 'utf8'));
  const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
  const routeCoordinates = route.features[0].geometry.coordinates;
  const eligibleWays = ways.filter(way => walkable(way, nodes));
  const usedIds = new Set();
  const edgeRows = [];
  eligibleWays.forEach(way => {
    for(let index = 0; index < way.refs.length - 1; index += 1){
      const from = nodes.get(way.refs[index]);
      const to = nodes.get(way.refs[index + 1]);
      if(!inBounds(from, bounds) || !inBounds(to, bounds)) continue;
      const distance = metres(from, to);
      if(!Number.isFinite(distance) || distance <= 0) continue;
      usedIds.add(from.id);
      usedIds.add(to.id);
      edgeRows.push([from.id, to.id, Math.round(distance * 10) / 10, way.tags.highway]);
    }
  });
  const ids = Array.from(usedIds).sort((a, b) => Number(a) - Number(b));
  const indexes = new Map(ids.map((id, index) => [id, index]));
  const graphNodes = ids.map(id => {
    const node = nodes.get(id);
    return [node.lng, node.lat];
  });
  const edges = edgeRows.map(edge => [indexes.get(edge[0]), indexes.get(edge[1]), edge[2], edge[3]]);
  const trailNodes = ids
    .map((id, index) => ({ index, node:nodes.get(id) }))
    .filter(item => nearestSegmentDistance(item.node, routeCoordinates) <= 12)
    .map(item => item.index);
  if(!edges.length || !trailNodes.length) throw new Error('No connected Carezza routing graph was produced.');
  const output = {
    schemaVersion:1,
    trailId:'lago-carezza',
    source:'OpenStreetMap bbox extract retrieved 2026-07-27',
    attribution:'© OpenStreetMap contributors · ODbL',
    bounds,
    restrictions:{
      excludes:['access=no', 'access=private', 'foot=no', 'foot=private', 'dog=no', 'difficult alpine SAC scales'],
      trailSnapM:12,
    },
    nodes:graphNodes,
    edges,
    trailNodes,
  };
  fs.writeFileSync(outputPath, JSON.stringify(output));
  console.log(JSON.stringify({ outputPath, nodes:graphNodes.length, edges:edges.length, trailNodes:trailNodes.length, bytes:fs.statSync(outputPath).size }, null, 2));
}

build();
