'use strict';

// Winter sun: how long the sun reaches a walk on the shortest day of the year.
//
// In winter, sun decides whether a path is icy and whether a short-coated dog
// is comfortable, and in the Alps it depends less on the weather than on the
// mountains around: a north-facing valley floor can see no direct sun from
// November to February while the slope opposite has six hours. This module
// works that out from the terrain alone:
//
//   1. the sun's path across the sky on 21 December at the walk's latitude;
//   2. the skyline seen from points along the walk, read off a terrain model
//      out to 20 km in the directions the sun crosses;
//   3. the minutes the sun stands above that skyline, averaged over the points.
//
// Trees, buildings and weather are not counted: it is the most sun the
// mountains allow, and the page says so.

const DEG = Math.PI / 180;
const EARTH_RADIUS_M = 6371000;
// Light bends over the horizon a little: the usual coefficient for the
// atmosphere near the ground.
const REFRACTION = 0.13;
// Declination of the sun at the December solstice.
const SOLSTICE_DECLINATION = -23.44;
// One sample of the sun every five minutes of solar time.
const STEP_MINUTES = 5;
// The skyline is read to this distance. Beyond 20 km even a 3,000 m peak sits
// under 5 degrees from a valley at 1,000 m, below the winter sun's noon height
// almost everywhere in the Alps.
const HORIZON_MAX_M = 20000;
// Eye height above the ground: a person, not a dog, but a metre either way
// changes nothing at these distances.
const EYE_M = 1.7;

// The sun's height and bearing every STEP_MINUTES of the solstice day, at a
// latitude in degrees. Bearing is degrees clockwise from north. Only the
// samples with the sun above the mathematical horizon are kept.
function solsticeSunPath(latitude, declination = SOLSTICE_DECLINATION, step = STEP_MINUTES){
  const phi = latitude * DEG;
  const delta = declination * DEG;
  const out = [];
  for(let minute = 0; minute < 24 * 60; minute += step){
    const hourAngle = ((minute + step / 2) / 60 - 12) * 15 * DEG;
    const sinElevation = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle);
    const elevation = Math.asin(sinElevation) / DEG;
    if(elevation <= 0) continue;
    const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi)) / DEG + 180 + 360) % 360;
    out.push({ minute, elevation, azimuth });
  }
  return out;
}

// The distances the skyline is read at: every 50 m close by, where a nearby
// slope rises fastest, then further apart.
function horizonDistances(max = HORIZON_MAX_M){
  const out = [];
  let d = 50;
  while(d <= max){
    out.push(d);
    d = d < 1000 ? d + 50 : Math.round(d * 1.04);
  }
  return out;
}
const DISTANCES = horizonDistances();

// A point the given distance and bearing from (lat, lng), on a sphere.
function destination(lat, lng, bearing, distance){
  const angular = distance / EARTH_RADIUS_M;
  const phi1 = lat * DEG;
  const lambda1 = lng * DEG;
  const theta = bearing * DEG;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(angular) + Math.cos(phi1) * Math.sin(angular) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(angular) * Math.cos(phi1), Math.cos(angular) - Math.sin(phi1) * Math.sin(phi2));
  return [phi2 / DEG, lambda2 / DEG];
}

// The skyline's angle above level, in degrees, looking along a bearing from a
// point. heightAt(lat, lng) gives the ground height in metres.
function horizonAngle(lat, lng, bearing, heightAt, eyeHeight){
  let best = -90;
  for(const distance of DISTANCES){
    const [la, ln] = destination(lat, lng, bearing, distance);
    const ground = heightAt(la, ln);
    if(!Number.isFinite(ground)) continue;
    const drop = (distance * distance) / (2 * EARTH_RADIUS_M) * (1 - REFRACTION);
    const angle = Math.atan2(ground - drop - eyeHeight, distance) / DEG;
    if(angle > best) best = angle;
  }
  return best;
}

// Minutes of direct sun at one point on the solstice: the sun samples that
// stand above the skyline in their own direction. Bearings are rounded to
// `bearingStep` degrees so neighbouring samples share a skyline reading.
function sunMinutesAt(lat, lng, heightAt, options = {}){
  const path = options.sunPath || solsticeSunPath(lat);
  const bearingStep = options.bearingStep || 2;
  const ground = heightAt(lat, lng);
  if(!Number.isFinite(ground)) return null;
  const eye = ground + EYE_M;
  const skyline = new Map();
  let minutes = 0;
  for(const sample of path){
    const bearing = Math.round(sample.azimuth / bearingStep) * bearingStep;
    if(!skyline.has(bearing)) skyline.set(bearing, horizonAngle(lat, lng, bearing, heightAt, eye));
    if(sample.elevation > skyline.get(bearing)) minutes += STEP_MINUTES;
  }
  return minutes;
}

// Up to `max` points spread evenly along a path of [lat, lng] pairs, by
// distance, ends included.
function samplePath(path, max = 20){
  const points = (path || []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if(points.length <= 2) return points.slice();
  const cumulative = [0];
  for(let i = 1; i < points.length; i += 1){
    const [a, b] = [points[i - 1], points[i]];
    const dy = (b[0] - a[0]) * 111320;
    const dx = (b[1] - a[1]) * 111320 * Math.cos(a[0] * DEG);
    cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
  }
  const total = cumulative[cumulative.length - 1];
  const count = Math.max(2, Math.min(max, Math.ceil(total / 250) + 1));
  const out = [];
  let j = 0;
  for(let k = 0; k < count; k += 1){
    const target = total * k / (count - 1);
    while(j < cumulative.length - 2 && cumulative[j + 1] < target) j += 1;
    const span = cumulative[j + 1] - cumulative[j] || 1;
    const t = Math.min(1, Math.max(0, (target - cumulative[j]) / span));
    const [a, b] = [points[j], points[j + 1]];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// A walk's winter sun: the average minutes of direct sun over its sampled
// points on 21 December, and the share of points that see none at all.
function walkWinterSun(path, heightAt, options = {}){
  const points = samplePath(path, options.maxPoints || 20);
  if(!points.length) return null;
  const sunPath = solsticeSunPath(points[0][0]);
  const minutes = points.map(([lat, lng]) => sunMinutesAt(lat, lng, heightAt, { ...options, sunPath })).filter(Number.isFinite);
  if(!minutes.length) return null;
  const mean = minutes.reduce((sum, m) => sum + m, 0) / minutes.length;
  return {
    hours: Math.round(mean / 6) / 10,
    noSunShare: Math.round(minutes.filter(m => m === 0).length / minutes.length * 100) / 100,
    points: minutes.length,
    flatHours: Math.round(sunPath.length * STEP_MINUTES / 6) / 10,
  };
}

// The built file's answer on each walk's season record, as
// trail.season.winterSun = { hours, noSunShare }. A walk without an entry
// gets nothing: no line, no tag.
function applyWinterSun(trails, artifact){
  const entries = (artifact && artifact.trails) || {};
  const known = new Set(trails.map(trail => trail.id));
  for(const [id, entry] of Object.entries(entries)){
    if(!known.has(id)) throw new Error(`Winter sun entry targets an unknown trail: ${id}`);
    if(!(Number.isFinite(entry.hours) && entry.hours >= 0 && entry.hours <= 9)) throw new Error(`Winter sun for ${id} has bad hours`);
    if(!(Number.isFinite(entry.noSunShare) && entry.noSunShare >= 0 && entry.noSunShare <= 1)) throw new Error(`Winter sun for ${id} has a bad no-sun share`);
  }
  return trails.map(trail => {
    const entry = entries[trail.id];
    if(!entry) return trail;
    return { ...trail, season: { ...(trail.season || {}), winterSun: { hours: entry.hours, noSunShare: entry.noSunShare } } };
  });
}

module.exports = {
  applyWinterSun,
  SOLSTICE_DECLINATION,
  HORIZON_MAX_M,
  STEP_MINUTES,
  solsticeSunPath,
  horizonDistances,
  destination,
  horizonAngle,
  sunMinutesAt,
  samplePath,
  walkWinterSun,
};
