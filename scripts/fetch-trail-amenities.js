#!/usr/bin/env node
// Fetch every OSM amenity within a corridor of each trail's real route line.
//
// Unlike the region-wide huts-bars/water dumps, this queries Overpass with an
// `around` corridor built from each trail's `path` geometry, so coverage is
// exactly "everything mapped within RADIUS_M of a trail we ship", bars,
// huts, water, viewpoints, picnic spots, shelters and sights, for 100% of
// trails in every region listed in the manifest.
//
// Outputs, per region:
//   data/trail-amenities/<region>-amenities.geojson       deduped feature dump
//   data/trail-amenities/<region>-trail-amenities.json    trailId -> amenity refs w/ distance
//   data/trail-amenities/coverage-report.json             per-trail counts + totals
//
// Usage: node scripts/fetch-trail-amenities.js [--radius 400]

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'trail-amenities');
const RADIUS_M = Number(process.argv.includes('--radius')
  ? process.argv[process.argv.indexOf('--radius') + 1]
  : 400);

// kumi first: the main instance 406es requests it does not like and queues
// heavily; the mirrors answer in seconds. A descriptive User-Agent is
// required by the Overpass usage policy, without it Apache rejects with 406.
const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const USER_AGENT = 'ORMA-trail-guide/1.0 (https://www.app-orma.com; hello@app-orma.com)';
const BATCH_SIZE = 6;

// What counts as an amenity for a dog-hiking app, grouped into the kinds the
// product talks about. Each entry is [overpassKey, regex] applied as nwr[key~regex].
const TAG_FILTERS = [
  ['amenity', '^(bar|cafe|restaurant|pub|fast_food|ice_cream|biergarten)$'],
  ['amenity', '^(drinking_water|fountain|water_point|watering_place|shelter|toilets|bbq)$'],
  ['tourism', '^(alpine_hut|wilderness_hut|viewpoint|picnic_site|attraction|museum|artwork|information)$'],
  ['natural', '^(spring)$'],
  ['man_made', '^(water_tap|water_well|cross)$'],
  ['leisure', '^(picnic_table)$'],
  ['historic', '^(wayside_cross|wayside_shrine|monument|memorial|castle|ruins|archaeological_site)$'],
];

function classify(tags) {
  const a = tags.amenity, t = tags.tourism;
  // Huts first: a rifugio that also serves food is a hut, not a restaurant.
  if (t === 'alpine_hut' || t === 'wilderness_hut') return 'hut';
  if (a && /^(bar|cafe|restaurant|pub|fast_food|ice_cream|biergarten)$/.test(a)) return 'refreshment';
  if (a === 'shelter') return 'shelter';
  if (a && /^(drinking_water|fountain|water_point|watering_place)$/.test(a)) return 'water';
  if (tags.natural === 'spring' || tags.man_made === 'water_tap' || tags.man_made === 'water_well') return 'water';
  if (t === 'viewpoint') return 'viewpoint';
  if (t === 'picnic_site' || tags.leisure === 'picnic_table' || a === 'bbq') return 'picnic';
  if (a === 'toilets') return 'toilets';
  // Only staffed info points count; guideposts and map boards are wayfinding
  // noise, not amenities.
  if (t === 'information') {
    return /^(office|visitor_centre)$/.test(tags.information || '') ? 'information' : 'other';
  }
  if (t === 'museum' || t === 'attraction' || t === 'artwork' || tags.historic) return 'sight';
  return 'other';
}

function loadRegionTrails(regionKey, manifest) {
  const rel = manifest.regions[regionKey].trails.split('?')[0];
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const start = raw.indexOf('incoming=');
  if (start === -1) throw new Error(`No incoming= payload in ${rel}`);
  const jsonStart = raw.indexOf('[', start);
  // The array literal ends at the matching bracket; walk it.
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = jsonStart; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) { esc = !esc && ch === '\\'; if (!esc && ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; esc = false; continue; }
    if (ch === '[') depth++;
    if (ch === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const trails = JSON.parse(raw.slice(jsonStart, end));
  return trails.filter(t => Array.isArray(t.path) && t.path.length >= 2);
}

// Thin the path so Overpass queries stay small: keep a point only once it is
// KEEP_EVERY_M from the last kept one. The corridor radius absorbs the error.
const KEEP_EVERY_M = 120;
function havM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function thinPath(pts) {
  const kept = [pts[0]];
  for (const p of pts.slice(1)) {
    const last = kept[kept.length - 1];
    if (havM(last[0], last[1], p[0], p[1]) >= KEEP_EVERY_M) kept.push(p);
  }
  const tail = pts[pts.length - 1];
  const lastKept = kept[kept.length - 1];
  if (lastKept[0] !== tail[0] || lastKept[1] !== tail[1]) kept.push(tail);
  return kept;
}

// Distance from a point to a polyline, via equirectangular segment projection
// (fine at corridor scales) with a haversine fallback for the endpoints.
function distToPathM(lat, lon, pts) {
  const toR = Math.PI / 180, R = 6371000;
  const refLat = lat * toR;
  const px = lon * toR * Math.cos(refLat) * R, py = lat * toR * R;
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][1] * toR * Math.cos(refLat) * R, ay = pts[i][0] * toR * R;
    const bx = pts[i + 1][1] * toR * Math.cos(refLat) * R, by = pts[i + 1][0] * toR * R;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx, qy = ay + t * dy;
    best = Math.min(best, Math.hypot(px - qx, py - qy));
  }
  return best;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

let endpointIdx = 0;
async function overpass(query, label) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const url = ENDPOINTS[endpointIdx % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(360000),
      });
      if (res.status === 429 || res.status === 504) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      endpointIdx++;
      const wait = 3000 * (attempt + 1);
      process.stdout.write(`\n  retry ${label}: ${err.message}, waiting ${wait / 1000}s\n`);
      await sleep(wait);
    }
  }
  throw new Error(`Overpass gave up on ${label}`);
}

// One bbox query per tag class per region: Overpass handles these far better
// than multi-hundred-coordinate `around` corridors. The precise "within
// RADIUS_M of a trail" cut happens locally against full-resolution paths.
function bboxQuery(key, re, bbox) {
  const [s, w, n, e] = bbox;
  return `[out:json][timeout:300];\nnwr["${key}"~"${re}"](${s},${w},${n},${e});\nout center tags;`;
}

function regionBbox(trails, marginDeg) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const t of trails) for (const [lat, lon] of t.path) {
    if (lat < s) s = lat; if (lat > n) n = lat;
    if (lon < w) w = lon; if (lon > e) e = lon;
  }
  return [s - marginDeg, w - marginDeg, n + marginDeg, e + marginDeg].map(x => x.toFixed(4));
}

function trailBbox(t, marginDeg) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const [lat, lon] of t.path) {
    if (lat < s) s = lat; if (lat > n) n = lat;
    if (lon < w) w = lon; if (lon > e) e = lon;
  }
  return [s - marginDeg, w - marginDeg, n + marginDeg, e + marginDeg];
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'regions-manifest.json'), 'utf8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), radiusM: RADIUS_M, regions: {} };

  for (const regionKey of Object.keys(manifest.regions)) {
    const trails = loadRegionTrails(regionKey, manifest);
    console.log(`\n=== ${regionKey}: ${trails.length} trails, corridor ${RADIUS_M} m ===`);
    const features = new Map();          // osmRef -> geojson feature
    const perTrail = {};                 // trailId -> [{ref, kind, name, distM}]
    const trailStats = {};

    // Fetch: one bbox query per tag class, cached to disk so reruns skip
    // clauses that already answered.
    const bbox = regionBbox(trails, 0.01);
    const elementsByRef = new Map();
    for (let ci = 0; ci < TAG_FILTERS.length; ci++) {
      const [key, re] = TAG_FILTERS[ci];
      const cachePath = path.join(OUT_DIR, `.bbox-${regionKey}-${ci}-${key}.json`);
      let elements;
      if (fs.existsSync(cachePath)) {
        elements = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        console.log(`  [cache] ${key}: ${elements.length} elements`);
      } else {
        const data = await overpass(bboxQuery(key, re, bbox), `${regionKey}/${key}`);
        elements = (data.elements || []).filter(el => (el.lat ?? el.center?.lat) != null && el.tags);
        fs.writeFileSync(cachePath, JSON.stringify(elements));
        console.log(`  [fetch] ${key}: ${elements.length} elements`);
        await sleep(1500);
      }
      for (const el of elements) {
        if (classify(el.tags) === 'other') continue;
        elementsByRef.set(`${el.type}/${el.id}`, el);
      }
    }
    const allElements = [...elementsByRef.entries()].map(([ref, el]) => ({
      ref,
      lat: el.lat ?? el.center.lat,
      lon: el.lon ?? el.center.lon,
      tags: el.tags,
      kind: classify(el.tags),
    }));
    console.log(`  ${allElements.length} candidate amenities in region bbox`);

    // Local corridor cut: coarse per-trail bbox prefilter, then exact
    // distance against the full-resolution path.
    const PREFILTER_DEG = 0.008;   // ~890 m lat / ~610 m lon at 46°N, > RADIUS_M
    for (const t of trails) {
      const [s, w, n, e] = trailBbox(t, PREFILTER_DEG);
      const rows = [];
      for (const el of allElements) {
        if (el.lat < s || el.lat > n || el.lon < w || el.lon > e) continue;
        const distM = Math.round(distToPathM(el.lat, el.lon, t.path));
        if (distM > RADIUS_M) continue;
        if (!features.has(el.ref)) {
          // Tags are spread flat so map style expressions and the shared
          // popup code can read them like the other POI GeoJSONs.
          features.set(el.ref, {
            type: 'Feature',
            properties: { ...el.tags, '@id': el.ref, kind: el.kind, name: el.tags.name || null },
            geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
          });
        }
        rows.push({ ref: el.ref, kind: el.kind, name: el.tags.name || null, distM });
      }
      rows.sort((x, y) => x.distM - y.distM);
      perTrail[t.id] = rows;
      const byKind = {};
      for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
      trailStats[t.id] = { name: t.name, total: rows.length, byKind };
    }

    const featureList = [...features.values()];
    fs.writeFileSync(
      path.join(OUT_DIR, `${regionKey}-amenities.geojson`),
      JSON.stringify({ type: 'FeatureCollection', features: featureList })
    );
    fs.writeFileSync(
      path.join(OUT_DIR, `${regionKey}-trail-amenities.json`),
      JSON.stringify({ radiusM: RADIUS_M, trails: perTrail })
    );
    const kindTotals = {};
    for (const f of featureList) kindTotals[f.properties.kind] = (kindTotals[f.properties.kind] || 0) + 1;
    report.regions[regionKey] = {
      trails: trails.length,
      trailsCovered: Object.keys(perTrail).length,
      uniqueAmenities: featureList.length,
      byKind: kindTotals,
      trailsWithZero: Object.entries(trailStats).filter(([, s]) => !s.total).map(([id]) => id),
      perTrail: trailStats,
    };
    console.log(`  -> ${featureList.length} unique amenities`, kindTotals);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'coverage-report.json'), JSON.stringify(report, null, 2));
  console.log('\nDone. Coverage report at data/trail-amenities/coverage-report.json');
}

main().catch(err => { console.error(err); process.exit(1); });
