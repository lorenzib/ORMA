#!/usr/bin/env node
'use strict';

/**
 * report-route-gaps — for every catalogue route held back for a geometry jump,
 * ask OpenStreetMap whether a walkable path already exists across the gap.
 *
 * Why this question and not another. Twenty-one trails are drafts because the
 * line that would be drawn for a walker jumps 1-6 km somewhere along it. #773
 * established that the order of the relation's pieces is not the cause for
 * these -- chaining them optimally leaves the gap. So each one is either:
 *
 *   - a relation missing a member way that is already mapped, which is an edit
 *     somebody can make in minutes; or
 *   - a stretch nobody has mapped at all, which needs a survey, or the route
 *     rejected.
 *
 * Those need completely different work and the catalogue cannot tell them
 * apart, so the drafts have sat undifferentiated. This asks Overpass for the
 * walkable ways around each gap, builds a graph from the shared nodes, and
 * reports whether the two ends are connected and how far apart they are along
 * real paths.
 *
 * Read-only. It fetches and prints; it writes no artifact and changes no trail.
 *
 *   node scripts/report-route-gaps.js
 *   node scripts/report-route-gaps.js --trail=osm-6244965
 */

const fs = require('fs');
const path = require('path');
const { toPath, haversineMeters } = require('./promote-osm-trails');
const { fetchWithRetries } = require('./fetch-dog-friendly-routes');

const ROOT = path.resolve(__dirname, '..');
const ROUTE_FILES = ['dog-friendly-routes.geojson', 'dog-friendly-routes-savoy.geojson'];

// The jump that holds a trail back, from scripts/trail-adapter.js. Read as the
// same number rather than retyped as a literal that can drift from it.
const PUBLICATION_GAP_KM = 1;

// What a dog walk may plausibly be routed along. Deliberately generous: the
// question is whether ANY mapped way connects the two ends, not whether it is
// the nicest one. Motorways and their links are excluded because a connector
// that is only reachable along one is not a walking connection.
const WALKABLE = ['path', 'footway', 'track', 'bridleway', 'steps', 'cycleway',
  'pedestrian', 'living_street', 'residential', 'unclassified', 'service',
  'tertiary', 'secondary'];

/** Every gap in a route that exceeds the publication limit. */
function gapsIn(geometry){
  const pts = toPath(geometry).pts;
  const gaps = [];
  for(let i = 1; i < pts.length; i += 1){
    const metres = haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    if(metres > PUBLICATION_GAP_KM * 1000) gaps.push({ from: pts[i - 1], to: pts[i], metres: Math.round(metres) });
  }
  return gaps;
}

/** A box around both ends of the gap, padded so a connector that loops out of
 *  the direct line is still inside it. */
function boundingBox(gap, padMetres = 600){
  const lats = [gap.from[0], gap.to[0]];
  const lngs = [gap.from[1], gap.to[1]];
  const padLat = padMetres / 111320;
  const padLng = padMetres / (111320 * Math.cos((lats[0] * Math.PI) / 180));
  return [
    Math.min(...lats) - padLat, Math.min(...lngs) - padLng,
    Math.max(...lats) + padLat, Math.max(...lngs) + padLng,
  ];
}

function query(gap){
  const [south, west, north, east] = boundingBox(gap);
  const bbox = `${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;
  return `[out:json][timeout:60];way["highway"~"^(${WALKABLE.join('|')})$"](${bbox});out geom;`;
}

/**
 * Are the two ends joined by the ways that came back?
 *
 * Nodes are keyed by rounded position rather than by id, so two ways that meet
 * at the same point but do not share a node id are still treated as connected.
 * That is the right side to err on here: the question is whether a walker
 * could get across, and this answers "is anything mapped along here" rather
 * than "is the relation routable as tagged".
 */
function connects(ways, gap){
  const key = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const graph = new Map();
  const link = (a, b) => {
    if(!graph.has(a)) graph.set(a, new Set());
    graph.get(a).add(b);
  };
  const positions = new Map();
  for(const way of ways){
    const geometry = way.geometry || [];
    for(let i = 0; i < geometry.length; i += 1){
      const node = key(geometry[i].lat, geometry[i].lon);
      positions.set(node, [geometry[i].lat, geometry[i].lon]);
      if(i){
        const previous = key(geometry[i - 1].lat, geometry[i - 1].lon);
        link(previous, node);
        link(node, previous);
      }
    }
  }
  if(!positions.size) return { connected: false, reason: 'nothing mapped in the box' };

  const nearest = point => {
    let best = null;
    for(const [node, position] of positions){
      const metres = haversineMeters(point[0], point[1], position[0], position[1]);
      if(!best || metres < best.metres) best = { node, metres };
    }
    return best;
  };
  const start = nearest(gap.from);
  const finish = nearest(gap.to);
  // If the route's own end is far from anything mapped, the gap is not a
  // missing member -- there is simply no path where the route stops.
  if(start.metres > 120 || finish.metres > 120){
    return { connected: false, reason: `route end is ${Math.round(Math.max(start.metres, finish.metres))} m from any mapped way` };
  }

  // Dijkstra over the walkable graph, so the answer carries how far round it is.
  const distance = new Map([[start.node, 0]]);
  const queue = [[0, start.node]];
  while(queue.length){
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, node] = queue.shift();
    if(node === finish.node) return { connected: true, alongPathsM: Math.round(cost) };
    if(cost > (distance.get(node) ?? Infinity)) continue;
    for(const next of graph.get(node) || []){
      const here = positions.get(node);
      const there = positions.get(next);
      const step = cost + haversineMeters(here[0], here[1], there[0], there[1]);
      if(step < (distance.get(next) ?? Infinity)){
        distance.set(next, step);
        queue.push([step, next]);
      }
    }
  }
  return { connected: false, reason: 'ways exist but do not join the two ends' };
}

function draftRoutes(only){
  const routes = [];
  for(const file of ROUTE_FILES){
    const full = path.join(ROOT, file);
    if(!fs.existsSync(full)) continue;
    for(const feature of JSON.parse(fs.readFileSync(full, 'utf8')).features || []){
      if(!feature.geometry) continue;
      const id = `osm-${feature.properties.osm_relation}`;
      if(only && id !== only) continue;
      const gaps = gapsIn(feature.geometry);
      if(gaps.length) routes.push({ id, name: feature.properties.name || '(unnamed)', gaps });
    }
  }
  return routes.sort((a, b) => a.gaps.length - b.gaps.length || a.gaps[0].metres - b.gaps[0].metres);
}

async function main(){
  const only = (process.argv.find(arg => arg.startsWith('--trail=')) || '').split('=')[1] || null;
  const routes = draftRoutes(only);
  console.log(`[gaps] ${routes.length} route(s) with a gap over ${PUBLICATION_GAP_KM} km\n`);

  const verdicts = { editable: [], unmapped: [], failed: [] };
  for(const route of routes){
    console.log(`[gaps] ${route.id} — ${route.name} (${route.gaps.length} gap(s))`);
    const outcomes = [];
    for(const gap of route.gaps){
      try{
        const payload = await fetchWithRetries(query(gap), { attempts: 2, timeoutMs: 90000 });
        const verdict = connects(payload.elements || [], gap);
        outcomes.push(verdict);
        if(verdict.connected){
          const detour = (verdict.alongPathsM / gap.metres).toFixed(1);
          console.log(`         ${gap.metres} m gap · CONNECTED along mapped paths in ${verdict.alongPathsM} m (${detour}x the straight line)`);
        }else{
          console.log(`         ${gap.metres} m gap · NOT CONNECTED — ${verdict.reason}`);
        }
      }catch(error){
        outcomes.push({ failed: true });
        console.log(`         ${gap.metres} m gap · could not be checked: ${error.message}`);
      }
    }
    if(outcomes.some(outcome => outcome.failed)) verdicts.failed.push(route.id);
    else if(outcomes.every(outcome => outcome.connected)) verdicts.editable.push(route.id);
    else verdicts.unmapped.push(route.id);
  }

  console.log('\n[gaps] ── what each one needs ──');
  console.log(`[gaps] ${verdicts.editable.length} need only a relation edit: the connecting way is already mapped.`);
  if(verdicts.editable.length) console.log(`[gaps]   ${verdicts.editable.join(' ')}`);
  console.log(`[gaps] ${verdicts.unmapped.length} need a survey or a rejection: no mapped way joins the ends.`);
  if(verdicts.unmapped.length) console.log(`[gaps]   ${verdicts.unmapped.join(' ')}`);
  if(verdicts.failed.length) console.log(`[gaps] ${verdicts.failed.length} could not be checked: ${verdicts.failed.join(' ')}`);
  console.log('\n[gaps] Nothing was changed.');
}

if(require.main === module){
  main().catch(error => { console.error(error); process.exit(1); });
}

module.exports = { gapsIn, boundingBox, connects, query, draftRoutes, PUBLICATION_GAP_KM };
