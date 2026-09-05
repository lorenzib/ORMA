#!/usr/bin/env node
'use strict';

/**
 * fetch-dog-friendly-routes.js
 *
 * Automates what was previously done by hand on hiking.waymarkedtrails.org:
 * pulls OSM hiking route RELATIONS for the Dolomite regions via Overpass,
 * scores them for dog-friendliness, detects loops, and writes a ready-to-use
 * GeoJSON that the map can load exactly like water-sources-all-regions.geojson.
 *
 * Two-phase design (gentle on Overpass):
 *   Phase 1: fetch tags-only for all named hiking/foot route relations,
 *            plus the IDs of relations that contain "hard" member ways
 *            (sac_scale >= T3, via ferrata, ladders, safety ropes, dog=no).
 *   Phase 2: fetch full geometry ONLY for the relations that passed filtering.
 *
 * Usage:
 *   node scripts/fetch-dog-friendly-routes.js
 *   node scripts/fetch-dog-friendly-routes.js --max-km 15 --loops-only
 *
 * Output: dog-friendly-routes.geojson (repo root, like the water sources file)
 * Manual curation: data/dog-route-overrides.json (force include/exclude, notes)
 */

const fs = require('fs/promises');
const path = require('path');

const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://overpass.osm.jp/api/interpreter'
    ];

// Overpass etiquette: identify the app so requests aren't treated as anonymous bots.
const USER_AGENT = 'ORMA-trail-fetcher/1.0 (+https://www.app-orma.com)';

// Same named-area + admin-level approach for every region. NOTE the admin
// levels differ by country: Italian regions are admin_level=4, French
// departments are admin_level=6.
const REGIONS = {
  dolomites: {
    label: 'Dolomites',
    adminLevel: 4,
    isoRegex: '^(IT-32|IT-34)$',                 // Trentino-Alto Adige, Veneto
    bbox: '46.15,11.0,46.85,12.55',              // Bolzano/Bressanone -> Belluno
    routesFile: 'dog-friendly-routes.geojson',
    accessFile: path.join('data', 'access-points.geojson'),
    reviewFile: path.join('data', 'dog-route-review.json')
  },
  savoy: {
    label: 'Savoy (Savoie + Haute-Savoie)',
    adminLevel: 6,
    isoRegex: '^(FR-73|FR-74)$',                 // Savoie, Haute-Savoie
    bbox: '45.00,5.60,46.45,7.10',               // Maurienne -> Lake Geneva -> Mont Blanc
    routesFile: 'dog-friendly-routes-savoy.geojson',
    accessFile: path.join('data', 'access-points-savoy.geojson'),
    reviewFile: path.join('data', 'dog-route-review-savoy.json')
  }
};

const ARGS = process.argv.slice(2);
const REGION_KEY = strArg('--region', 'dolomites');
const REGION = REGIONS[REGION_KEY];
if (!REGION) {
  console.error(`Unknown --region "${REGION_KEY}". Available: ${Object.keys(REGIONS).join(', ')}`);
  process.exit(1);
}

const OUTPUT_PATH = path.resolve(__dirname, '..', REGION.routesFile);
const OVERRIDES_PATH = path.resolve(__dirname, '..', 'data', 'dog-route-overrides.json'); // shared: OSM relation ids are globally unique

// sac_scale values considered NOT dog friendly (T3 and above)
const HARD_SAC = '^(demanding_mountain_hiking|alpine_hiking|demanding_alpine_hiking|difficult_alpine_hiking)$';

const MAX_KM = numArg('--max-km', 20);        // routes longer than this are dropped
const LOOPS_ONLY = ARGS.includes('--loops-only');
// --bbox-only restricts to the region's mountain bbox (--dolomites-only kept as alias)
const BBOX_ONLY = ARGS.includes('--bbox-only') || ARGS.includes('--dolomites-only');
const LOOP_CLOSE_METERS = 300;                 // start/end closer than this => loop

function numArg(flag, fallback) {
  const i = ARGS.indexOf(flag);
  if (i === -1 || i === ARGS.length - 1) return fallback;
  const v = Number(ARGS[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}

function strArg(flag, fallback) {
  const i = ARGS.indexOf(flag);
  if (i === -1 || i === ARGS.length - 1) return fallback;
  return ARGS[i + 1];
}

/* ---------------------------------------------------------------- Overpass */

function buildPhase1Query() {
  const bbox = BBOX_ONLY ? `(${REGION.bbox})` : '';
  return [
    '[out:json][timeout:180];',
    `area["boundary"="administrative"]["admin_level"="${REGION.adminLevel}"]["ISO3166-2"~"${REGION.isoRegex}"]->.regions;`,
    `relation(area.regions)${bbox}["type"="route"]["route"~"^(hiking|foot)$"]["name"]->.routes;`,
    '.routes out tags;',
    // Member ways that make a route unsuitable for dogs:
    `way(r.routes)["sac_scale"~"${HARD_SAC}"]->.hard1;`,
    'way(r.routes)["highway"="via_ferrata"]->.hard2;',
    'way(r.routes)["via_ferrata_scale"]->.hard3;',
    'way(r.routes)["ladder"="yes"]->.hard4;',
    'way(r.routes)["safety_rope"="yes"]->.hard5;',
    'way(r.routes)["dog"="no"]->.hard6;',
    '(.hard1; .hard2; .hard3; .hard4; .hard5; .hard6;)->.hardways;',
    // Relations that contain any of those ways -> exclude list
    'rel(bw.hardways)->.hardrels;',
    '.hardrels out ids;'
  ].join('\n');
}

function buildPhase2Query(relationIds) {
  return [
    '[out:json][timeout:180];',
    `relation(id:${relationIds.join(',')});`,
    'out geom;'
  ].join('\n');
}

// Companion query: surface/path tags of the member ways, so terrain can be
// described from real OSM data instead of guessed.
function buildWayTagsQuery(relationIds) {
  return [
    '[out:json][timeout:180];',
    `relation(id:${relationIds.join(',')})->.r;`,
    'way(r.r)["surface"];',
    'out ids tags;'
  ].join('\n');
}

// Phase 3: real-world access points (parking, lift stations, bus stops) used
// by the promote script to anchor verified starting points.
function buildAccessPointsQuery() {
  return [
    '[out:json][timeout:300];',
    `node["amenity"="parking"](${REGION.bbox});`,
    'out center tags;',
    `way["amenity"="parking"](${REGION.bbox});`,
    'out center tags;',
    `node["aerialway"="station"](${REGION.bbox});`,
    'out center tags;',
    `node["highway"="bus_stop"](${REGION.bbox});`,
    'out center tags;'
  ].join('\n');
}

async function fetchWithRetries(body, options = {}) {
  const attempts = options.attempts || 3;
  const timeoutMs = options.timeoutMs || 120000;
  let lastError = null;

  for (const url of OVERPASS_URLS) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        console.log(`[fetch] Attempt ${attempt}/${attempts} -> ${url}`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'user-agent': USER_AGENT
          },
          body: `data=${encodeURIComponent(body)}`,
          signal: controller.signal
        });
        if (!response.ok) {
          const err = new Error(`Overpass returned HTTP ${response.status}`);
          err.status = response.status;
          throw err;
        }
        return await response.json();
      } catch (error) {
        lastError = error;
        console.warn(`[fetch] ${url} failed: ${error.message}`);
        // 429/406 = rate limited or blocked: waiting longer is the only cure.
        const rateLimited = error.status === 429 || error.status === 406;
        const waitMs = rateLimited ? 45000 * attempt : 2000 * attempt;
        console.log(`[fetch] Waiting ${Math.round(waitMs / 1000)}s before next attempt…`);
        await new Promise((r) => setTimeout(r, waitMs));
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  throw lastError || new Error('All Overpass mirrors failed');
}

/* --------------------------------------------------------------- Filtering */

const LOOP_NAME_RE = /\b(giro|anello|rund(weg|wanderung|tour)|loop|circuito|ring)\b/i;

function evaluateRelation(tags, isHard, overrides) {
  const id = tags.__id;
  const reasons = [];
  const override = overrides[String(id)];

  if (override && override.include === false) {
    return { keep: false, reasons: ['manual exclude: ' + (override.note || '')] };
  }

  if (isHard) reasons.push('contains T3+/ferrata/ladder/dog=no way');
  if (tags.dog === 'no') reasons.push('relation tagged dog=no');
  if (tags.sac_scale && new RegExp(HARD_SAC).test(tags.sac_scale)) {
    reasons.push(`relation sac_scale=${tags.sac_scale}`);
  }

  const km = parseDistanceKm(tags.distance);
  if (km !== null && km > MAX_KM) reasons.push(`distance ${km} km > ${MAX_KM} km`);

  const loop = tags.roundtrip === 'yes' || LOOP_NAME_RE.test(tags.name || '');
  if (LOOPS_ONLY && !loop) reasons.push('not a loop (loops-only mode)');

  if (override && override.include === true) {
    return { keep: true, reasons: ['manual include'], loop, km };
  }
  return { keep: reasons.length === 0, reasons, loop, km };
}

function parseDistanceKm(raw) {
  if (!raw) return null;
  const m = String(raw).replace(',', '.').match(/([\d.]+)\s*(km|m)?/i);
  if (!m) return null;
  let v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  if ((m[2] || 'km').toLowerCase() === 'm') v /= 1000;
  return Math.round(v * 10) / 10;
}

/* ---------------------------------------------------------------- Geometry */

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Douglas-Peucker simplification (tolerance in degrees; ~0.00005 ≈ 5 m)
function simplify(points, tolerance = 0.00005) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const num = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
    const den = Math.hypot(y2 - y1, x2 - x1) || 1e-12;
    const d = num / den;
    if (d > maxDist) { maxDist = d; index = i; }
  }
  if (maxDist > tolerance) {
    const left = simplify(points.slice(0, index + 1), tolerance);
    const right = simplify(points.slice(index), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

// Stitch relation member ways into as few continuous lines as possible,
// so loop detection and rendering are cleaner than raw fragments.
function stitchMembers(members) {
  const segments = members
    .filter((m) => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length > 1)
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  if (!segments.length) return [];

  const lines = [];
  const pool = segments.slice();
  const close = (a, b) => haversineMeters(a, b) < 30;

  while (pool.length) {
    let line = pool.shift();
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < pool.length; i += 1) {
        const seg = pool[i];
        if (close(line[line.length - 1], seg[0])) {
          line = line.concat(seg.slice(1)); pool.splice(i, 1); extended = true; break;
        }
        if (close(line[line.length - 1], seg[seg.length - 1])) {
          line = line.concat(seg.slice(0, -1).reverse()); pool.splice(i, 1); extended = true; break;
        }
        if (close(line[0], seg[seg.length - 1])) {
          line = seg.slice(0, -1).concat(line); pool.splice(i, 1); extended = true; break;
        }
        if (close(line[0], seg[0])) {
          line = seg.slice(1).reverse().concat(line); pool.splice(i, 1); extended = true; break;
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

function isClosedLoop(lines) {
  if (lines.length !== 1) return false;
  const line = lines[0];
  return haversineMeters(line[0], line[line.length - 1]) < LOOP_CLOSE_METERS;
}

function pathLengthKm(lines) {
  let meters = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) meters += haversineMeters(line[i - 1], line[i]);
  }
  return Math.round((meters / 1000) * 10) / 10;
}

/* -------------------------------------------------------------------- Main */

async function loadOverrides() {
  try {
    return JSON.parse(await fs.readFile(OVERRIDES_PATH, 'utf8'));
  } catch {
    // Create a starter file the first time so there's a place to curate.
    const starter = {
      '_comment': 'Keyed by OSM relation id. {"include": true|false, "note": "...", "leash": "required|recommended", "dogFriendlyNotes": "..."}',
      '1640016': { include: true, note: 'manually verified on waymarkedtrails' },
      '9437627': { include: true, note: 'manually verified on waymarkedtrails' }
    };
    await fs.mkdir(path.dirname(OVERRIDES_PATH), { recursive: true });
    await fs.writeFile(OVERRIDES_PATH, JSON.stringify(starter, null, 2));
    console.log(`[overrides] Created starter file at ${OVERRIDES_PATH}`);
    return starter;
  }
}

async function main() {
  const overrides = await loadOverrides();

  console.log('[phase1] Fetching route relation tags + hard-way exclusion list…');
  const phase1 = await fetchWithRetries(buildPhase1Query());

  const relations = [];
  const hardIds = new Set();
  for (const el of phase1.elements || []) {
    if (el.type !== 'relation') continue;
    if (el.tags) {
      relations.push({ ...el.tags, __id: el.id });
    } else {
      hardIds.add(el.id); // ids-only output from .hardrels
    }
  }
  console.log(`[phase1] ${relations.length} named hiking routes, ${hardIds.size} flagged as hard.`);

  const kept = [];
  const rejected = [];
  for (const tags of relations) {
    const verdict = evaluateRelation(tags, hardIds.has(tags.__id), overrides);
    if (verdict.keep) kept.push({ tags, verdict });
    else rejected.push({ id: tags.__id, name: tags.name, reasons: verdict.reasons });
  }
  console.log(`[filter] kept ${kept.length}, rejected ${rejected.length} (see review file).`);

  // Geometry in small batches to keep responses light (504s = server strain).
  const features = [];
  const BATCH = 25;
  for (let i = 0; i < kept.length; i += BATCH) {
    const batch = kept.slice(i, i + BATCH);
    console.log(`[phase2] Geometry batch ${i / BATCH + 1}/${Math.ceil(kept.length / BATCH)}…`);
    const data = await fetchWithRetries(buildPhase2Query(batch.map((k) => k.tags.__id)));

    // Surface tags of member ways (best-effort: terrain data is a bonus).
    const waySurface = new Map();
    try {
      const wayData = await fetchWithRetries(buildWayTagsQuery(batch.map((k) => k.tags.__id)));
      for (const w of wayData.elements || []) {
        if (w.type === 'way' && w.tags && w.tags.surface) waySurface.set(w.id, w.tags.surface);
      }
    } catch (err) {
      console.warn(`[phase2] Surface-tag query failed for this batch: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000));

    for (const el of data.elements || []) {
      if (el.type !== 'relation') continue;
      if (!el.members || !el.members.length) {
        console.warn(`[phase2] WARNING: relation ${el.id} returned no member geometry, skipped.`);
        continue;
      }
      const match = batch.find((k) => k.tags.__id === el.id);
      if (!match) continue;

      const lines = stitchMembers(el.members).map((l) => simplify(l));
      if (!lines.length) continue;

      // Aggregate surface breakdown (km per surface value) from member ways.
      const surfaces = {};
      for (const m of el.members) {
        if (m.type !== 'way' || !Array.isArray(m.geometry) || m.geometry.length < 2) continue;
        const s = waySurface.get(m.ref);
        if (!s) continue;
        let meters = 0;
        for (let j = 1; j < m.geometry.length; j += 1) {
          meters += haversineMeters(
            [m.geometry[j - 1].lon, m.geometry[j - 1].lat],
            [m.geometry[j].lon, m.geometry[j].lat]
          );
        }
        surfaces[s] = Math.round(((surfaces[s] || 0) + meters / 1000) * 10) / 10;
      }

      const lengthKm = pathLengthKm(lines);
      // Drop degenerate/broken geometries (e.g. two identical points).
      if (lengthKm < 0.3) {
        console.warn(`[phase2] Dropped relation ${el.id} (${match.tags.name}): degenerate geometry (${lengthKm} km).`);
        continue;
      }

      // Loop = what the GEOMETRY says, not what tags/names claim:
      // one continuous line, >= 1 km, ends meeting within LOOP_CLOSE_METERS.
      const loop = lengthKm >= 1 && isClosedLoop(lines);
      if (LOOPS_ONLY && !loop && !match.verdict.loop) continue;

      const t = match.tags;
      const ov = overrides[String(el.id)] || {};
      features.push({
        type: 'Feature',
        properties: {
          osm_relation: el.id,
          name: t.name,
          'name:it': t['name:it'] || null,
          'name:de': t['name:de'] || null,
          ref: t.ref || null,
          network: t.network || null,
          distance_km: match.verdict.km || lengthKm,
          surfaces: Object.keys(surfaces).length ? surfaces : null,
          sac_scale: t.sac_scale || null,
          loop,
          symbol: t['osmc:symbol'] || null,
          website: t.website || null,
          leash: ov.leash || null,
          dogFriendlyNotes: ov.dogFriendlyNotes || null,
          waymarkedtrails: `https://hiking.waymarkedtrails.org/#route?id=${el.id}`
        },
        geometry: lines.length === 1
          ? { type: 'LineString', coordinates: lines[0] }
          : { type: 'MultiLineString', coordinates: lines }
      });
    }
    await new Promise((r) => setTimeout(r, 3000)); // be polite between batches
  }

  const collection = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    source: 'OpenStreetMap via Overpass API',
    attribution: '© OpenStreetMap contributors (ODbL)',
    features
  };
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(collection));
  console.log(`[done] Wrote ${features.length} routes -> ${OUTPUT_PATH}`);

  // Phase 3: access points (parking, lift stations, bus stops) for verified
  // starting-point assignment in promote-osm-trails.js.
  console.log('[phase3] Fetching access points (parking, lifts, bus stops)…');
  try {
    const ap = await fetchWithRetries(buildAccessPointsQuery());
    const apFeatures = (ap.elements || [])
      .map((el) => {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number') return null;
        const t = el.tags || {};
        const kind = t.aerialway === 'station' ? 'lift station'
          : t.highway === 'bus_stop' ? 'bus stop' : 'parking';
        return {
          type: 'Feature',
          properties: {
            kind,
            name: t.name || null,
            osmId: `${el.type}/${el.id}`,
            access: t.access || null,
            fee: t.fee || null,
            parking: t.parking || null
          },
          geometry: { type: 'Point', coordinates: [lon, lat] }
        };
      })
      .filter(Boolean);
    const apPath = path.resolve(__dirname, '..', REGION.accessFile);
    await fs.writeFile(apPath, JSON.stringify({
      type: 'FeatureCollection',
      generatedAt: new Date().toISOString(),
      attribution: '© OpenStreetMap contributors (ODbL)',
      features: apFeatures
    }));
    console.log(`[phase3] Wrote ${apFeatures.length} access points -> ${apPath}`);
  } catch (err) {
    console.warn(`[phase3] Access points fetch failed (start points will fall back to route geometry): ${err.message}`);
  }

  // Review file so rejects can be rescued via the overrides file.
  const reviewPath = path.resolve(__dirname, '..', REGION.reviewFile);
  await fs.writeFile(reviewPath, JSON.stringify(rejected, null, 2));
  console.log(`[done] Rejection reasons -> ${reviewPath} (rescue any via dog-route-overrides.json)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
