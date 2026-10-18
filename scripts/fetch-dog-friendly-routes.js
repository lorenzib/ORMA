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

/**
 * Failures this host will give every time, so asking it again is lost minutes.
 *
 * An expired certificate is the case that prompted this. `overpass.osm.jp`'s
 * lapsed, and because the loop treated it like a busy server the run spent
 * three attempts and their backoff on a handshake that could never succeed --
 * and then reported its TLS error as the reason the whole fetch failed, with
 * the three mirrors that had actually been tried nowhere in the message. A
 * mirror in this state is skipped at once and the next one tried.
 *
 * Not removed from the list: a certificate gets renewed, a name starts
 * resolving again. Skipping fast is right, forgetting the mirror is not.
 */
const PERMANENT_FOR_THIS_HOST = new Set([
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'ENOTFOUND', 'ECONNREFUSED',
]);

/** The code, when this is a failure retrying cannot cure; otherwise null. */
function permanentForThisHost(error) {
  // Node's fetch wraps a transport failure, so the code is on `cause`.
  const code = error?.cause?.code || error?.code;
  return PERMANENT_FOR_THIS_HOST.has(code) ? code : null;
}

async function fetchWithRetries(body, options = {}) {
  const attempts = options.attempts || 3;
  const timeoutMs = options.timeoutMs || 120000;
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || (ms => new Promise((r) => setTimeout(r, ms)));
  const urls = options.urls || OVERPASS_URLS;
  // The last reason each mirror gave, so a total failure can say what every
  // mirror did rather than only what the last one happened to do.
  const reasons = new Map();

  for (const [index, url] of urls.entries()) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        console.log(`[fetch] Attempt ${attempt}/${attempts} -> ${url}`);
        const response = await fetchImpl(url, {
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
        const permanent = permanentForThisHost(error);
        reasons.set(url, permanent ? `${permanent}, which a retry cannot change` : error.message);
        console.warn(`[fetch] ${url} failed: ${reasons.get(url)}`);
        if (permanent) break;
        // Nothing left to wait for: this was the last attempt at the last
        // mirror, and the only thing after it is the throw below.
        const lastChance = attempt === attempts && index === urls.length - 1;
        if (lastChance) break;
        // 429/406 = rate limited or blocked: waiting longer is the only cure.
        const rateLimited = error.status === 429 || error.status === 406;
        const waitMs = rateLimited ? 45000 * attempt : 2000 * attempt;
        console.log(`[fetch] Waiting ${Math.round(waitMs / 1000)}s before next attempt…`);
        await sleep(waitMs);
      } finally {
        clearTimeout(timeout);
      }
    }
  }
  const summary = [...reasons].map(([url, reason]) => `  ${url}: ${reason}`).join('\n');
  throw new Error(`All ${urls.length} Overpass mirror(s) failed:\n${summary}`);
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

  // A closed ring has no baseline to measure against. With the first and last
  // point equal, every point in between measures zero distance from the line
  // through them, so the whole ring collapses to two identical points: length
  // zero, and the walk is dropped downstream as degenerate geometry.
  //
  // Not a theoretical case. It is exactly what a correctly tagged roundtrip
  // looks like once its approach and excursion members are left out -- the last
  // way's final node IS the first way's first node, so the coordinates are
  // bit-identical. Appending a spur used to leave the ends apart and hide this:
  // refreshing 41 relations after the member-role fix turned 18 of them into
  // 0 km, Toblacher Höhenweg from 27.3 km and Rundweg Peitlerkofel from 11.8.
  //
  // Split at the point furthest from the start and simplify each half, which is
  // the standard treatment. Both halves have distinct ends, so this recurses
  // once and terminates.
  const [fx, fy] = points[0];
  const [lx, ly] = points[points.length - 1];
  if (fx === lx && fy === ly) {
    let far = 0;
    let farDist = 0;
    for (let i = 1; i < points.length - 1; i += 1) {
      const d = Math.hypot(points[i][0] - fx, points[i][1] - fy);
      if (d > farDist) { farDist = d; far = i; }
    }
    // farDist 0 means every point is the same point: genuinely degenerate, and
    // the ordinary path below reduces it to two, which is correct.
    if (farDist > 0) {
      const head = simplify(points.slice(0, far + 1), tolerance);
      const tail = simplify(points.slice(far), tolerance);
      return head.slice(0, -1).concat(tail);
    }
  }

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

/**
 * The members that are the walk, as OSM's hiking-route schema defines them.
 *
 * A member with no role is the route. `approach` is how a walker reaches it,
 * `excursion` an optional side trip, `alternative`/`alternate` a variant, and
 * `link`/`connection` a joining stretch. None of those is the line a reader is
 * told to walk, and stitching them in is what produced the "geometry jump" that
 * held 18 of 22 draft trails out of publication: the path walked the loop back
 * to the trailhead and then teleported to the start of a spur. Measured
 * 16 October, relation 11795251 (`1 - Dörferrundweg`) had a widest gap of
 * 4.08 km with every member and 0.14 km without these, and relation 12164395
 * 2.07 km against 0.08 km. Both relations are `roundtrip=yes` and their plain
 * members close to within 81 and 29 metres.
 *
 * `forward` and `backward` are kept, because they ARE the route: they mark a
 * direction-specific carriageway where it splits. Nine catalogue relations tag
 * every member that way and have no plain member at all, so treating any role
 * as off-route would leave them with no geometry whatever -- two of them,
 * osm-12121798 and osm-12127424, are trails the verification gate would pass.
 *
 * Named roles rather than an allowlist, so a role nobody has met yet is kept.
 * Wrongly keeping one repeats a jump this already catches; wrongly dropping one
 * deletes a walk's geometry, which is far worse.
 */
// How much of a relation's own way members must come back with a line before
// its geometry is treated as the truth about the walk. Overpass answering
// thinly is common; a hiking relation genuinely losing most of its ways is not.
const MINIMUM_GEOMETRY_SHARE = 0.8;

// How much of the previous catalogue a regeneration may lose before it refuses
// to publish. OSM does change and a trail can legitimately go, but a tenth of
// the catalogue disappearing in one run is a failed fetch, not a changed map.
const MAXIMUM_CATALOGUE_LOSS = 0.1;

// How far apart two member ways' ends may be and still be the same walk.
//
// It was 30 m, and that is tighter than the mapping. Gsieser Talblickweg lists
// its route in three groups separated by 44 m and 85 m -- one continuous walk
// on the ground, three disconnected pieces here, which the promoter then
// chained back together across those same gaps and reported as broken
// geometry. Twelve catalogue trails have a break of this size.
//
// 100 m is still well under the shortest gap that has turned out to be real
// (134 m), so nothing that is genuinely two separate stretches is welded
// together by it.
const STITCH_TOLERANCE_M = 100;

const OFF_ROUTE_ROLES = new Set([
  'approach', 'excursion', 'alternative', 'alternate', 'link', 'connection',
]);

function isRouteMember(member) {
  return member?.type === 'way'
    && !OFF_ROUTE_ROLES.has(String(member.role || '').trim().toLowerCase());
}

// Stitch relation member ways into as few continuous lines as possible,
// so loop detection and rendering are cleaner than raw fragments.
function stitchMembers(members) {
  const segments = (members || [])
    .filter((m) => isRouteMember(m) && Array.isArray(m.geometry) && m.geometry.length > 1)
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  if (!segments.length) return [];

  const lines = [];
  const pool = segments.slice();
  const close = (a, b) => haversineMeters(a, b) < STITCH_TOLERANCE_M;

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

/**
 * Does this walk come back to where it started?
 *
 * Asked of the piece covering the most ground, not of the relation as a whole.
 * It used to refuse outright whenever the relation held more than one piece,
 * and never reached the question it is named for -- so a circuit that closes
 * to the metre was recorded as not a loop because the relation also listed a
 * stray fragment somewhere else in the valley. Twelve catalogue walks are
 * labelled that way today, Roda dles Viles among them, whose ends meet at 0 m.
 *
 * The stray piece is a fact about the relation. Whether the walk returns to
 * its start is a fact about the walk, and that is what a reader is asking.
 *
 * Measured by ground covered rather than by point count, so a dense short
 * fragment cannot be mistaken for the walk.
 */
function isClosedLoop(lines) {
  const pieces = (lines || []).filter((line) => Array.isArray(line) && line.length > 1);
  if (!pieces.length) return false;
  let main = pieces[0];
  let mainKm = pathLengthKm([main]);
  for (const line of pieces.slice(1)) {
    const km = pathLengthKm([line]);
    if (km > mainKm) { main = line; mainKm = km; }
  }
  return haversineMeters(main[0], main[main.length - 1]) < LOOP_CLOSE_METERS;
}

function pathLengthKm(lines) {
  let meters = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) meters += haversineMeters(line[i - 1], line[i]);
  }
  return Math.round((meters / 1000) * 10) / 10;
}

/* ------------------------------------------ Geometry, in one definition */

const GEOMETRY_BATCH = 25;

/**
 * Everything one relation's geometry decides, from its members.
 *
 * One definition, used by the full pass that rebuilds the whole file and by the
 * targeted refresh below, so a refreshed feature and a freshly discovered one
 * cannot disagree. Returns null where there is no line to draw, which is what
 * the full pass already treats as nothing to publish.
 *
 * `distance_km` keeps the relation's own `distance` tag ahead of the measured
 * length, exactly as the full pass does: the operator's published figure is
 * better evidence than a sum over a simplified line, and only fills in from the
 * geometry where no tag exists.
 */
function geometryOf(members, tags, waySurface) {
  const lines = stitchMembers(members).map((l) => simplify(l));
  if (!lines.length) return null;

  const surfaces = {};
  for (const m of members || []) {
    if (!isRouteMember(m) || !Array.isArray(m.geometry) || m.geometry.length < 2) continue;
    const s = waySurface?.get(m.ref);
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
  return {
    lines,
    lengthKm,
    // The properties geometry decides. Everything else on a feature comes from
    // the relation's tags and is not this function's business.
    properties: {
      distance_km: parseDistanceKm(tags?.distance) || lengthKm,
      surfaces: Object.keys(surfaces).length ? surfaces : null,
      // Loop = what the GEOMETRY says, not what tags or names claim.
      loop: lengthKm >= 1 && isClosedLoop(lines),
    },
    geometry: lines.length === 1
      ? { type: 'LineString', coordinates: lines[0] }
      : { type: 'MultiLineString', coordinates: lines },
  };
}

/**
 * Re-read the geometry of named relations, and change nothing else.
 *
 * The full pass rediscovers the area -- 2,826 named routes and 2,197 candidates
 * against the 92 features on file the day this was written -- so running it to
 * correct geometry also adds and retires trails on the strength of whatever
 * OpenStreetMap looks like that morning. Those are product decisions, and
 * burying them in a geometry correction makes the change unreviewable. It is
 * also 88 batches against an Overpass that answers some of them with a 504.
 *
 * So this takes the relations asked for, keeps the feature list exactly as it
 * is, and replaces only what `geometryOf` decides. A relation that is not
 * already on file is reported and skipped rather than added: putting a walk in
 * the catalogue is not a refresh.
 */
async function refreshGeometry(relationIds, options = {}) {
  const runQuery = options.fetchQuery || fetchWithRetries;
  const file = options.outputPath || OUTPUT_PATH;
  const collection = JSON.parse(await fs.readFile(file, 'utf8'));
  const onFile = new Map(collection.features
    .map((feature) => [Number(feature.properties?.osm_relation), feature]));

  const wanted = [...new Set((relationIds || []).map(Number).filter(Number.isFinite))];
  const absent = wanted.filter((id) => !onFile.has(id));
  const present = wanted.filter((id) => onFile.has(id));
  const changed = [], identical = [], failed = [];

  for (let i = 0; i < present.length; i += GEOMETRY_BATCH) {
    const batch = present.slice(i, i + GEOMETRY_BATCH);
    console.log(`[refresh] Geometry batch ${i / GEOMETRY_BATCH + 1}/${Math.ceil(present.length / GEOMETRY_BATCH)}…`);
    const data = await runQuery(buildPhase2Query(batch));

    const waySurface = new Map();
    try {
      const tagged = await runQuery(buildWayTagsQuery(batch));
      for (const w of tagged.elements || []) {
        if (w.tags?.surface) waySurface.set(w.id, w.tags.surface);
      }
    } catch (err) {
      // The full pass warns and carries on here too; a missing surface
      // breakdown is thinner data, not wrong data.
      console.warn(`[refresh] Surface-tag query failed for this batch: ${err.message}`);
    }

    const returned = new Set();
    for (const el of data.elements || []) {
      if (el.type !== 'relation') continue;
      returned.add(el.id);
      const feature = onFile.get(el.id);
      if (!feature) continue;
      const built = geometryOf(el.members || [], el.tags || {}, waySurface);
      if (!built) { failed.push({ id: el.id, why: 'no route members left a line' }); continue; }
      const before = JSON.stringify(feature.geometry);
      const record = { id: el.id, name: feature.properties?.name,
        wasKm: feature.properties?.distance_km, nowKm: built.properties.distance_km };
      feature.geometry = built.geometry;
      Object.assign(feature.properties, built.properties);
      if (before === JSON.stringify(feature.geometry)) identical.push(record);
      else changed.push(record);
    }
    for (const id of batch) {
      if (!returned.has(id)) failed.push({ id, why: 'not returned by the query' });
    }
    if (i + GEOMETRY_BATCH < present.length) await new Promise((r) => setTimeout(r, 3000));
  }

  if (!options.dryRun) {
    collection.generatedAt = new Date().toISOString();
    await fs.writeFile(file, JSON.stringify(collection));
  }
  return { file, changed, identical, failed, absent,
    total: collection.features.length, written: !options.dryRun };
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

/** `--relations 123,456` -- the ids to refresh, or null for a full pass. */
function relationsArg() {
  const i = ARGS.indexOf('--relations');
  if (i === -1) return null;
  const ids = String(ARGS[i + 1] || '').split(/[,\s]+/).map(Number).filter(Number.isFinite);
  return ids.length ? ids : null;
}

async function main() {
  const only = relationsArg();
  if (only) {
    console.log(`[refresh] Re-reading the geometry of ${only.length} relation(s); the feature list is left alone.`);
    const result = await refreshGeometry(only, { dryRun: ARGS.includes('--dry-run') });
    console.log(`[refresh] ${result.total} feature(s) on file.`);
    for (const entry of result.changed) {
      const moved = entry.wasKm !== entry.nowKm ? `  ${entry.wasKm} -> ${entry.nowKm} km` : '';
      console.log(`[refresh]   CHANGED  ${entry.id} · ${entry.name || ''}${moved}`);
    }
    if (result.identical.length) console.log(`[refresh]   ${result.identical.length} unchanged.`);
    for (const entry of result.absent) {
      console.log(`[refresh]   not on file, skipped: ${entry} (adding a walk is not a refresh)`);
    }
    for (const entry of result.failed) console.log(`[refresh]   FAILED   ${entry.id} · ${entry.why}`);
    console.log(result.written
      ? `[refresh] Wrote ${result.file}. Re-run promote-osm-trails.js for the region, then the quality gate.`
      : '[refresh] Dry run. Nothing written.');
    return;
  }

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
  // Relations whose geometry did not arrive, as against trails that are
  // genuinely unusable. Collected so the run can refuse to publish a
  // catalogue that a flaky fetch has quietly shrunk.
  const incomplete = [];
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
        incomplete.push({ id: el.id, name: '(no members returned)', ways: 0, withGeometry: 0 });
        continue;
      }
      const match = batch.find((k) => k.tags.__id === el.id);
      if (!match) continue;

      // A thin response is not a broken trail.
      //
      // Overpass can return a relation with its members listed but their
      // geometry missing or partial. Stitching that gives a stub, and the
      // degenerate check below then reads it as a trail too short to publish
      // and drops it -- so a bad minute at Overpass silently deletes walks
      // that are perfectly fine. Replaying one such batch by hand returned
      // 36 of 36 member ways with geometry for a relation this had just
      // called 0 km.
      //
      // Counted rather than guessed: how many of the relation's own way
      // members came back with a usable line. Below the floor the response is
      // the problem, so the run says so and the trail is left alone instead of
      // being dropped on the strength of data that never arrived.
      const wayMembers = el.members.filter((m) => m.type === 'way');
      const withGeometry = wayMembers
        .filter((m) => Array.isArray(m.geometry) && m.geometry.length > 1).length;
      if (wayMembers.length && withGeometry / wayMembers.length < MINIMUM_GEOMETRY_SHARE) {
        console.warn(`[phase2] INCOMPLETE: relation ${el.id} (${match.tags.name}) returned geometry for `
          + `${withGeometry}/${wayMembers.length} ways; not dropping it on a partial answer.`);
        incomplete.push({ id: el.id, name: match.tags.name, ways: wayMembers.length, withGeometry });
        continue;
      }

      // The geometry and what it decides, from the one definition the targeted
      // refresh also uses, so a refreshed feature and a freshly discovered one
      // cannot disagree.
      const built = geometryOf(el.members, el.tags || match.tags, waySurface);
      if (!built) continue;
      const { lengthKm } = built;
      // Drop degenerate/broken geometries (e.g. two identical points).
      if (lengthKm < 0.3) {
        console.warn(`[phase2] Dropped relation ${el.id} (${match.tags.name}): degenerate geometry (${lengthKm} km).`);
        continue;
      }

      const loop = built.properties.loop;
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
          distance_km: built.properties.distance_km,
          surfaces: built.properties.surfaces,
          sac_scale: t.sac_scale || null,
          loop,
          symbol: t['osmc:symbol'] || null,
          // Checked live against OSM 2026-09-15: four routes publish their page
          // under `url` or `contact:website` and were being recorded as having
          // none. Takes effect on the next monthly refresh.
          website: t.website || t.url || t['contact:website'] || null,
          leash: ov.leash || null,
          dogFriendlyNotes: ov.dogFriendlyNotes || null,
          waymarkedtrails: `https://hiking.waymarkedtrails.org/#route?id=${el.id}`
        },
        geometry: built.geometry
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
  // Never publish a catalogue a bad fetch has emptied.
  //
  // Phase 2 drops a relation it cannot measure, so a run that half-fails ends
  // with a smaller file and nothing to say it went wrong -- the website then
  // loses the trail pages. Compare against what is already on disk, and treat
  // a large loss as the run failing rather than the map changing.
  const previous = await readPreviousCatalogue(OUTPUT_PATH);
  if (previous !== null) {
    const gone = previous.filter((id) => !features.some((f) => f.properties.osm_relation === id));
    const share = previous.length ? gone.length / previous.length : 0;
    if (incomplete.length) {
      console.warn(`[guard] ${incomplete.length} relation(s) returned incomplete geometry this run.`);
    }
    if (share > MAXIMUM_CATALOGUE_LOSS && !ARGS.includes('--allow-shrink')) {
      console.error(`[guard] Refusing to write: ${gone.length} of ${previous.length} routes `
        + `(${Math.round(share * 100)}%) would disappear from ${path.basename(OUTPUT_PATH)}.`);
      if (incomplete.length) {
        console.error('[guard] Incomplete geometry this run, which is the usual cause:');
        for (const entry of incomplete.slice(0, 10)) {
          console.error(`[guard]   relation ${entry.id} (${entry.name}): ${entry.withGeometry}/${entry.ways} ways`);
        }
      }
      console.error('[guard] Re-run when Overpass is healthy, or pass --allow-shrink if the loss is real.');
      process.exitCode = 1;
      return;
    }
    if (gone.length) console.log(`[guard] ${gone.length} route(s) no longer present; within tolerance.`);
  }

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

// Guarded so the Overpass client can be reused by other scripts without this
// one fetching the whole catalogue on import. Running it directly is unchanged.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// The mirror list, the user agent and the backoff are the part worth sharing:
// a second copy is how one of them learns about a dead mirror and the other
// does not.
/** The relation ids already published, or null when there is no file yet. */
async function readPreviousCatalogue(file) {
  try {
    const existing = JSON.parse(await fs.readFile(file, 'utf8'));
    return (existing.features || [])
      .map((f) => f && f.properties && f.properties.osm_relation)
      .filter((id) => id !== undefined && id !== null);
  } catch {
    return null;
  }
}

module.exports = { fetchWithRetries, permanentForThisHost, PERMANENT_FOR_THIS_HOST,
  OVERPASS_URLS, USER_AGENT,
  OFF_ROUTE_ROLES, STITCH_TOLERANCE_M, isRouteMember, stitchMembers,
  geometryOf, refreshGeometry, simplify, pathLengthKm, isClosedLoop, parseDistanceKm,
  MINIMUM_GEOMETRY_SHARE, MAXIMUM_CATALOGUE_LOSS, readPreviousCatalogue };
