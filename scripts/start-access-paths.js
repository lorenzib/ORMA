'use strict';

// The walk-in from a walk's start flag to its line (data/start-access-paths.json,
// written by scripts/build-start-access-paths.js). It is put on the walk as
// trail.accessPath = { path, lengthM } and drawn as a thin dashed line: it is
// how you reach the walk, not part of it, so the walk's distance, climb and
// time never include it.

const DATA_FILE = 'data/start-access-paths.json';
// A start flag further than this from the line needs a walk-in.
const THRESHOLD_M = 30;
// Longer than this and it is a walk of its own: the owner decides.
const MAX_LENGTH_M = 1000;
// The walk-in belongs to the start it was routed from. If the start moves
// more than this, it is dropped and the check asks for a new one.
const START_MATCH_M = 15;

function metres(a, b){
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// The nearest point of a [lat, lng] line to a point, and how far it is.
function nearestOnLine(point, line){
  const rad = Math.PI / 180;
  const R = 6371000;
  const cos = Math.cos(point.lat * rad);
  let best = { distanceM:Infinity, point:null, index:0 };
  for(let i = 1; i < line.length; i += 1){
    const a = line[i - 1];
    const b = line[i];
    const ax = (a[1] - point.lng) * rad * R * cos;
    const ay = (a[0] - point.lat) * rad * R;
    const bx = (b[1] - point.lng) * rad * R * cos;
    const by = (b[0] - point.lat) * rad * R;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const f = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const d = Math.hypot(ax + dx * f, ay + dy * f);
    if(d < best.distanceM){
      best = { distanceM:d, point:[a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], index:i - 1 };
    }
  }
  if(line.length === 1) best = { distanceM:metres(point, { lat:line[0][0], lng:line[0][1] }), point:line[0], index:0 };
  return best;
}

function lineLength(line){
  let total = 0;
  for(let i = 1; i < line.length; i += 1){
    total += metres({ lat:line[i - 1][0], lng:line[i - 1][1] }, { lat:line[i][0], lng:line[i][1] });
  }
  return total;
}

function startGapM(trail){
  if(!trail || !trail.startPoint || !Array.isArray(trail.path) || trail.path.length < 2) return 0;
  return nearestOnLine(trail.startPoint, trail.path).distanceM;
}

// "about 2.1 km" or "about 450 m": the walk-in's length as the start line says it.
function accessDistanceWords(lengthM){
  return lengthM >= 1000 ? { value:Math.round(lengthM / 100) / 10, unit:'km' } : { value:Math.round(lengthM / 10) * 10, unit:'m' };
}

function applyStartAccessPaths(trails, data){
  const paths = (data && data.paths) || {};
  return trails.map(trail => {
    const record = trail && paths[trail.id];
    if(!record || !trail.startPoint) return trail;
    const routedFrom = { lat:record.start[0], lng:record.start[1] };
    if(metres(routedFrom, trail.startPoint) > START_MATCH_M) return trail;
    const accessPath = { path:record.path, lengthM:record.lengthM };
    // Named under "Where to start" (owner's call per walk, data.overCap).
    if(record.startLine && Number.isFinite(record.climbM)) Object.assign(accessPath, { climbM:record.climbM, startLine:true });
    return { ...trail, accessPath };
  });
}

module.exports = {
  DATA_FILE,
  THRESHOLD_M,
  MAX_LENGTH_M,
  START_MATCH_M,
  metres,
  nearestOnLine,
  lineLength,
  startGapM,
  applyStartAccessPaths,
  accessDistanceWords,
};
