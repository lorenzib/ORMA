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
  // Which way each step belongs to. A connection twice the straight line is
  // either the terrain or a router going the wrong way round, and the only
  // way to tell from a report is to say what it is made of.
  const wayOfEdge = new Map();
  for(const way of ways){
    const geometry = way.geometry || [];
    const label = `${way.tags?.highway || 'way'}${way.tags?.name ? ` \u201c${way.tags.name}\u201d` : ''}`;
    for(let i = 0; i < geometry.length; i += 1){
      const node = key(geometry[i].lat, geometry[i].lon);
      positions.set(node, [geometry[i].lat, geometry[i].lon]);
      if(i){
        const previous = key(geometry[i - 1].lat, geometry[i - 1].lon);
        link(previous, node);
        link(node, previous);
        wayOfEdge.set(`${previous}|${node}`, label);
        wayOfEdge.set(`${node}|${previous}`, label);
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
  const cameFrom = new Map();
  const queue = [[0, start.node]];
  while(queue.length){
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, node] = queue.shift();
    if(node === finish.node){
      const along = [];
      let cursor = node;
      while(cameFrom.has(cursor)){
        const label = wayOfEdge.get(`${cameFrom.get(cursor)}|${cursor}`);
        if(label && along[along.length - 1] !== label) along.push(label);
        cursor = cameFrom.get(cursor);
      }
      return { connected: true, alongPathsM: Math.round(cost), madeOf: [...new Set(along.reverse())] };
    }
    if(cost > (distance.get(node) ?? Infinity)) continue;
    for(const next of graph.get(node) || []){
      const here = positions.get(node);
      const there = positions.get(next);
      const step = cost + haversineMeters(here[0], here[1], there[0], there[1]);
      if(step < (distance.get(next) ?? Infinity)){
        cameFrom.set(next, node);
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

/**
 * One gap's answer, and the checkpoint it is written into.
 *
 * The first full run was cancelled on the job timeout with eight routes
 * unchecked, and the answers it had already paid Overpass for survived only
 * because they happened to be in the log. A checkpoint written after every gap
 * means a run that is cut short still hands over what it learned, and the next
 * run skips what is already known rather than asking again.
 */
const CHECKPOINT = path.join(ROOT, 'route-gap-report.json');

function loadCheckpoint(){
  if(!fs.existsSync(CHECKPOINT)) return {};
  try{ return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).gaps || {}; }
  catch(error){ return {}; }
}

function saveCheckpoint(gaps){
  fs.writeFileSync(CHECKPOINT, `${JSON.stringify({ generatedAt: new Date().toISOString(), gaps }, null, 2)}\n`);
}

/** A gap identifies itself by where it is, so the key survives a route-file
 *  refresh that changes how many pieces a relation has. */
const gapKey = (id, gap) => `${id}@${gap.from[0].toFixed(5)},${gap.from[1].toFixed(5)}`;

function describe(gap, verdict){
  if(verdict.failed) return `${gap.metres} m gap \u00b7 could not be checked: ${verdict.error}`;
  if(verdict.connected){
    const detour = verdict.alongPathsM / gap.metres;
    const line = `${gap.metres} m gap \u00b7 CONNECTED along mapped paths in ${verdict.alongPathsM} m`
      + ` (${detour.toFixed(1)}x the straight line)`;
    // Only where the way round is long enough to wonder about. Below this it
    // is a direct connector and the detail is noise.
    if(detour >= 1.5 && (verdict.madeOf || []).length){
      return `${line}\n           made of: ${verdict.madeOf.join(', ')}`;
    }
    return line;
  }
  return `${gap.metres} m gap \u00b7 NOT CONNECTED \u2014 ${verdict.reason}`;
}

function summarise(routes, gaps){
  const verdicts = { editable: [], unmapped: [], unchecked: [] };
  for(const route of routes){
    const answers = route.gaps.map(gap => gaps[gapKey(route.id, gap)]).filter(Boolean);
    if(answers.length < route.gaps.length || answers.some(answer => answer.failed)) verdicts.unchecked.push(route.id);
    else if(answers.every(answer => answer.connected)) verdicts.editable.push(route.id);
    else verdicts.unmapped.push(route.id);
  }
  return verdicts;
}

function report(routes, gaps){
  const verdicts = summarise(routes, gaps);
  console.log('\n[gaps] \u2500\u2500 what each one needs \u2500\u2500');
  console.log(`[gaps] ${verdicts.editable.length} need only a relation edit: the connecting way is already mapped.`);
  if(verdicts.editable.length) console.log(`[gaps]   ${verdicts.editable.join(' ')}`);
  console.log(`[gaps] ${verdicts.unmapped.length} need a survey or a rejection: no mapped way joins the ends.`);
  if(verdicts.unmapped.length) console.log(`[gaps]   ${verdicts.unmapped.join(' ')}`);
  if(verdicts.unchecked.length){
    console.log(`[gaps] ${verdicts.unchecked.length} still unanswered \u2014 run again to pick them up:`);
    console.log(`[gaps]   ${verdicts.unchecked.join(' ')}`);
  }
  console.log(`[gaps] Checkpoint: ${path.relative(ROOT, CHECKPOINT)}`);
  console.log('\n[gaps] Nothing was changed.');
  return verdicts;
}

async function askAbout(gap){
  // Shorter per-request timeout and fewer attempts than the catalogue fetcher
  // uses: this asks many small questions rather than one large one, and a
  // mirror that has not answered in 45 seconds is costing the run more than
  // the answer is worth. Anything missed is retried in the second pass.
  const payload = await fetchWithRetries(query(gap), { attempts: 2, timeoutMs: 45000 });
  return connects(payload.elements || [], gap);
}

async function main(){
  const only = (process.argv.find(arg => arg.startsWith('--trail=')) || '').split('=')[1] || null;
  const routes = draftRoutes(only);
  const gaps = loadCheckpoint();
  const answered = gap => gaps[gap] && !gaps[gap].failed;
  const known = routes.reduce((count, route) =>
    count + route.gaps.filter(gap => answered(gapKey(route.id, gap))).length, 0);
  console.log(`[gaps] ${routes.length} route(s) with a gap over ${PUBLICATION_GAP_KM} km`);
  if(known) console.log(`[gaps] ${known} gap(s) already answered in the checkpoint, and will not be asked again`);
  console.log('');

  // Printed before the process can be killed, so a cancelled run still ends
  // with the tally rather than a severed list of lines.
  let finished = false;
  for(const signal of ['SIGTERM', 'SIGINT']){
    process.on(signal, () => {
      if(!finished){
        console.log(`\n[gaps] stopped on ${signal} \u2014 reporting what is known so far`);
        report(routes, gaps);
      }
      process.exit(1);
    });
  }

  // Two passes: everything once, then whatever the mirrors refused. A failure
  // here is almost always the mirror rather than the question, and asking the
  // same question later usually answers it.
  for(const pass of [1, 2]){
    const outstanding = routes.flatMap(route => route.gaps
      .filter(gap => !answered(gapKey(route.id, gap)))
      .map(gap => ({ route, gap })));
    if(!outstanding.length) break;
    if(pass === 2) console.log(`\n[gaps] second pass over ${outstanding.length} gap(s) the mirrors refused\n`);
    for(const { route, gap } of outstanding){
      let verdict;
      try{ verdict = await askAbout(gap); }
      catch(error){ verdict = { failed: true, error: error.message }; }
      gaps[gapKey(route.id, gap)] = { ...verdict, trailId: route.id, name: route.name, metres: gap.metres };
      saveCheckpoint(gaps);
      console.log(`[gaps] ${route.id} \u2014 ${route.name}`);
      console.log(`         ${describe(gap, verdict)}`);
    }
  }

  finished = true;
  report(routes, gaps);
}

if(require.main === module){
  main().catch(error => { console.error(error); process.exit(1); });
}

module.exports = { gapsIn, boundingBox, connects, query, draftRoutes, gapKey, summarise, describe, CHECKPOINT, PUBLICATION_GAP_KM };
