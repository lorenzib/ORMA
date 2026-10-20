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

/**
 * A way that makes a route unsuitable for a dog.
 *
 * The discovery pass asks Overpass for these as six set expressions and keeps
 * the relations that contain none. A single relation imported on its own is
 * read from the OSM API instead -- one request that returns every member with
 * its tags, rather than three Overpass mirrors that answer some requests with
 * a 504 -- so the same question has to be askable of a way's tags here.
 *
 * Two readings of one rule, so a test reads the query out of this file and
 * asserts this predicate answers yes to each line of it. Dogs are the reason
 * the rule exists; it is not one to let drift.
 */
function hardWayForDogs(tags) {
  if (!tags) return false;
  if (tags.sac_scale && new RegExp(HARD_SAC).test(tags.sac_scale)) return true;
  if (tags.highway === 'via_ferrata') return true;
  if (tags.via_ferrata_scale) return true;
  if (tags.ladder === 'yes') return true;
  if (tags.safety_rope === 'yes') return true;
  if (tags.dog === 'no') return true;
  return false;
}

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
/**
 * Every member way of these relations, with its tags.
 *
 * `buildWayTagsQuery` asks only for the ways that carry a surface, because
 * that is all the promoter needs. Importing one relation on its own also has
 * to ask whether any of its ways makes the route unsuitable for a dog, which
 * the discovery pass answers for a whole region at once with six set
 * expressions. For one relation it is cheaper and plainer to read the tags.
 */
function buildMemberWayQuery(relationIds) {
  return [
    '[out:json][timeout:180];',
    `relation(id:${relationIds.join(',')})->.r;`,
    'way(r.r);',
    'out ids tags;'
  ].join('\n');
}

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

// How much of the ground its own members cover a drawn line must still show.
//
// The share above counts how many members arrived carrying a line. It cannot
// see a member that arrives and then does not reach the output, because it is
// taken before anything is built. Three Savoy walks passed it with every
// member present and were written short anyway: Au pied du Roc d'Enfer at
// 0.75 km of a 12.74 km relation, Albannette petite boucle at 3.62 of 5.01,
// Boucle des cascades at 7.06 of 8.56. Their exactly closed rings had
// collapsed inside `simplify`, which #831 has since fixed -- but nothing
// measured the loss, so the three sat in the published catalogue from
// 1 October until 18 October, and the 1.06 km hole in Albannette's line is
// why #867 held the walk back and deleted a page that was live.
//
// So the line is measured against its own members before it is believed.
// Stitching only concatenates member geometry, so a line can fall short of
// them only through simplification -- 1-2% at a 5 m tolerance, measured on the
// catalogue's longest walks -- while welds between member ends add length
// rather than remove it. A tenth of the walk missing is not simplification; it
// is geometry that did not survive the build.
const MINIMUM_DRAWN_SHARE = 0.9;

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

// How far apart two way ends may be and still be the SAME place rather than
// two places close together.
//
// Members that share an OSM node arrive carrying identical coordinates on both
// transports, so this is a guard against a rounding difference, not a
// tolerance for sloppy mapping -- that is what STITCH_TOLERANCE_M is for, and
// spending it here instead costs the catalogue real accuracy (see
// `junctionGraph`).
const COINCIDENT_END_M = 1;

const OFF_ROUTE_ROLES = new Set([
  'approach', 'excursion', 'alternative', 'alternate', 'link', 'connection',
]);

function isRouteMember(member) {
  return member?.type === 'way'
    && !OFF_ROUTE_ROLES.has(String(member.role || '').trim().toLowerCase());
}

/** How many of a relation's way members came back carrying a line. */
function memberGeometryShare(members) {
  const ways = (members || []).filter((m) => m?.type === 'way');
  if (!ways.length) return null;
  const withGeometry = ways
    .filter((m) => Array.isArray(m.geometry) && m.geometry.length > 1).length;
  return { ways: ways.length, withGeometry, share: withGeometry / ways.length };
}

/**
 * The ground this relation's own on-route members cover, before anything is
 * stitched or simplified. The yardstick the drawn line is held against.
 */
function memberLengthKm(members) {
  let meters = 0;
  for (const m of members || []) {
    if (!isRouteMember(m) || !Array.isArray(m.geometry) || m.geometry.length < 2) continue;
    for (let i = 1; i < m.geometry.length; i += 1) {
      meters += haversineMeters(
        [m.geometry[i - 1].lon, m.geometry[i - 1].lat],
        [m.geometry[i].lon, m.geometry[i].lat]
      );
    }
  }
  return meters / 1000;
}

/**
 * Join a relation's member ways into as few continuous lines as possible, by
 * traversing them as a graph rather than laying them end to end.
 *
 * A route relation is not a list of ways to be concatenated; it is a network.
 * OSM splits a route's members at its junctions, so the members are edges and
 * the places their ends meet are nodes, and drawing the walk means finding a
 * run through that network that uses every edge.
 *
 * The old stitcher only ever extended a line at its two free ends, and that
 * cannot pass through a junction at all: at a place where three ways meet it
 * takes one continuation and orphans the third. Seeweg (relation 3885162) is
 * the shape that shows it. Its 48 members are a single connected network of
 * 11.75 km -- a closed western loop with an eastern lobe hanging off two
 * three-way junctions. Stitched nose to tail the loop closed first, both
 * junctions were then interior to a finished line, and the lobe could never be
 * attached: three pieces, which the promoter then joined with 3.12 km of
 * straight line across the valley, and the publication gate held the walk back
 * for the jump. The hole was ours, not OpenStreetMap's.
 *
 * Traversed as a graph the same 48 members are one line of 11.76 km whose
 * widest step is 374 m -- and that step is a straight run of mapped path
 * inside one way, not a hole, because the lines are simplified.
 *
 * One line per connected group of members. Where a relation's members really
 * are detached from one another -- three catalogue relations are, by 1 to
 * 10 km -- they stay separate lines, because that gap is a hole in the map and
 * drawing over it is the fault this exists to stop.
 *
 * `STITCH_TOLERANCE_M` still decides what "meet" means. Node ids would be the
 * exact answer and neither transport carries them this far: Overpass
 * `out geom` and the OSM API reader both flatten a member to a list of
 * lat/lon, so ends that coincide are recognised by where they are, as they
 * were before.
 */
function stitchMembers(members) {
  const ways = (members || [])
    .filter((m) => isRouteMember(m) && Array.isArray(m.geometry) && m.geometry.length > 1)
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  if (!ways.length) return [];

  const graph = junctionGraph(ways);
  return componentsOf(graph).map((component) => lineThrough(graph, component));
}

/**
 * The network a relation's member ways form: its junctions, and the ways
 * between them.
 *
 * Built in three steps, and the order matters.
 *
 * Ends that COINCIDE are one junction. That is the relation's real topology,
 * and two members sharing an OSM node arrive carrying identical coordinates on
 * either transport, so it costs no tolerance to see.
 *
 * A member that runs THROUGH another member's end is then cut there, because
 * that is a junction too. OSM only has to split a way where it needs to, so a
 * loop hanging off the middle of a longer way is mapped as exactly that: three
 * catalogue relations have a 80-210 m ring attached to a walk that was never
 * split to meet it, and without the cut the ring is a piece of its own that
 * nothing can reach. Cutting a line at one of its own vertices moves no point
 * and changes no length.
 *
 * Only then is `STITCH_TOLERANCE_M` spent, and only on dead ends, where a line
 * that has run out has another line's loose end within reach.
 *
 * Doing the first step with the loose tolerance instead was measurably wrong:
 * lumping every end within a hundred metres into one junction forgets which
 * ends actually touch, so the trail welds across the slack rather than through
 * the join. It drew 1.05 km of invented line into Lang-Erl-Weg's 2.86 km walk
 * and 3.47 km into Gsieser's, and left 33 relations with a junction whose own
 * ends lay further apart than the tolerance that had merged them.
 *
 * `degree` counts ends meeting at a junction, so a way that closes on itself
 * contributes two and stays even, while `at` lists it once because walking it
 * once returns you there.
 */
function junctionGraph(ways) {
  const places = [];
  const placeAt = (point) => {
    for (let i = 0; i < places.length; i += 1) {
      if (haversineMeters(places[i], point) <= COINCIDENT_END_M) return i;
    }
    places.push(point);
    return places.length - 1;
  };
  for (const coords of ways) { placeAt(coords[0]); placeAt(coords[coords.length - 1]); }

  const ends = placeIndex(places);
  const cut = [];
  for (const coords of ways) {
    const at = [0];
    for (let v = 1; v < coords.length - 1; v += 1) if (ends(coords[v]) !== null) at.push(v);
    at.push(coords.length - 1);
    for (let i = 1; i < at.length; i += 1) {
      const piece = coords.slice(at[i - 1], at[i] + 1);
      if (piece.length > 1) cut.push(piece);
    }
  }

  const drawn = cut.map((coords) => {
    let meters = 0;
    for (let i = 1; i < coords.length; i += 1) meters += haversineMeters(coords[i - 1], coords[i]);
    return { coords, meters, from: placeAt(coords[0]), to: placeAt(coords[coords.length - 1]) };
  });

  const junctionOf = bridgeDeadEnds(places, drawn);
  const nodes = [];
  const numbered = new Map();
  const number = (place) => {
    const junction = junctionOf(place);
    if (!numbered.has(junction)) { numbered.set(junction, nodes.length); nodes.push(places[junction]); }
    return numbered.get(junction);
  };
  const edges = drawn.map((edge) => ({ ...edge, from: number(edge.from), to: number(edge.to) }));

  const at = nodes.map(() => []);
  const degree = nodes.map(() => 0);
  edges.forEach((edge, index) => {
    at[edge.from].push(index);
    degree[edge.from] += 1;
    degree[edge.to] += 1;
    if (edge.to !== edge.from) at[edge.to].push(index);
  });
  return { nodes, edges, at, degree };
}

/**
 * Look up whether a point is already one of these places.
 *
 * Over a grid, because the caller asks it of every vertex of every member --
 * tens of thousands of questions against hundreds of places on the longer
 * relations. Cells are about 11 m across and the answer has to be within
 * COINCIDENT_END_M, so the nine cells around a point are all it can be in.
 */
function placeIndex(places) {
  const CELL = 1e4;
  const key = (point) => `${Math.round(point[0] * CELL)}:${Math.round(point[1] * CELL)}`;
  const grid = new Map();
  places.forEach((point, index) => {
    const cell = key(point);
    if (!grid.has(cell)) grid.set(cell, []);
    grid.get(cell).push(index);
  });
  return (point) => {
    const x = Math.round(point[0] * CELL);
    const y = Math.round(point[1] * CELL);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const index of grid.get(`${x + dx}:${y + dy}`) || []) {
          if (haversineMeters(places[index], point) <= COINCIDENT_END_M) return index;
        }
      }
    }
    return null;
  };
}

/**
 * Join up the loose ends a relation's mapping leaves, closest pair first.
 *
 * A dead end is where the drawn line runs out. Where two of them are within
 * `STITCH_TOLERANCE_M` the walk continues across, which is the judgement that
 * tolerance was widened to 100 m to make: Gsieser Talblickweg's route is
 * mapped in groups separated by 44 m and 85 m, and Seeweg's eastern tip fails
 * to close by 13 m. Nothing else is merged -- a dead end beside the MIDDLE of
 * another way is a walk that genuinely stops there, and so is one with no
 * neighbour inside the tolerance.
 *
 * Closest pair first, so a 13 m join is never passed over for a 90 m one that
 * happened to be looked at earlier. Returns the junction each place belongs to.
 */
function bridgeDeadEnds(places, edges) {
  const parent = places.map((_, index) => index);
  const find = (index) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== root) { const up = parent[index]; parent[index] = root; index = up; }
    return root;
  };
  for (;;) {
    const degree = new Map();
    for (const edge of edges) {
      for (const place of [find(edge.from), find(edge.to)]) {
        degree.set(place, (degree.get(place) || 0) + 1);
      }
    }
    const loose = [...degree.keys()].filter((place) => degree.get(place) === 1);
    let best = null;
    for (let i = 0; i < loose.length; i += 1) {
      for (let j = i + 1; j < loose.length; j += 1) {
        const gap = haversineMeters(places[loose[i]], places[loose[j]]);
        if (gap < STITCH_TOLERANCE_M && (!best || gap < best.gap)) {
          best = { gap, keep: loose[i], join: loose[j] };
        }
      }
    }
    if (!best) return find;
    parent[find(best.join)] = find(best.keep);
  }
}

/** Groups of members that are joined to each other, each as its own walk. */
function componentsOf(graph) {
  const seen = graph.nodes.map(() => false);
  const groups = [];
  for (let start = 0; start < graph.nodes.length; start += 1) {
    if (seen[start] || !graph.at[start].length) continue;
    const nodes = [];
    const edges = new Set();
    const queue = [start];
    seen[start] = true;
    while (queue.length) {
      const node = queue.shift();
      nodes.push(node);
      for (const index of graph.at[node]) {
        edges.add(index);
        for (const next of [graph.edges[index].from, graph.edges[index].to]) {
          if (!seen[next]) { seen[next] = true; queue.push(next); }
        }
      }
    }
    groups.push({ nodes: nodes.sort((a, b) => a - b), edges: [...edges].sort((a, b) => a - b) });
  }
  return groups;
}

/**
 * One continuous line covering every member in a connected group.
 *
 * A single line can use every edge exactly once only where at most two nodes
 * have an odd number of ends meeting at them -- and those two are then where
 * it begins and finishes. 145 of the 149 catalogue relations are already like
 * that: 95 groups close into a circuit and 52 run between two ends.
 *
 * Above two, some stretch has to be covered twice, which is exactly what a
 * walker does at a dead end. Four catalogue relations are shaped that way, all
 * of them with four such ends. The stretch walked twice is chosen as the
 * shortest run of mapped path between two of them, so the line doubles back
 * along the route instead of jumping across country -- and because it is real
 * ground it counts towards the distance, unlike a connector drawn over a hole
 * in the map, which does not.
 */
function lineThrough(graph, component) {
  const legs = component.edges.map((index) => graph.edges[index]);
  const odd = component.nodes.filter((node) => graph.degree[node] % 2 === 1);
  const retraced = retraceOddEnds(graph, component, odd);
  const walked = legs.concat(retraced.legs);
  // Start where the line has to: at an end if it has any, otherwise anywhere
  // on a circuit, and the lowest node is the first one the members introduced.
  const start = retraced.ends.length ? retraced.ends[0] : component.nodes[0];
  return drawTrail(walked, trailFrom(walked, graph.nodes.length, start));
}

/**
 * Which stretches to cover twice so one line can reach everything, and which
 * two ends the line is then left running between.
 *
 * Pairs up the surplus odd ends cheapest-first. With four ends -- every case
 * the catalogue has -- exactly one pair is doubled back along, so taking the
 * cheapest pair is the shortest answer there is. With more it is a good one
 * rather than a proven best, which is the right trade for a shape no relation
 * currently has.
 */
function retraceOddEnds(graph, component, odd) {
  if (odd.length <= 2) return { legs: [], ends: odd };
  const remaining = odd.slice();
  const legs = [];
  while (remaining.length > 2) {
    let best = null;
    for (let i = 0; i < remaining.length; i += 1) {
      for (let j = i + 1; j < remaining.length; j += 1) {
        const run = shortestRun(graph, component, remaining[i], remaining[j]);
        if (run && (!best || run.meters < best.run.meters)) best = { i, j, run };
      }
    }
    // Two ends with no path between them cannot be in one group, so this is
    // unreachable -- but leaving the pair odd would make the trail undrawable,
    // so stop rather than loop.
    if (!best) break;
    for (const index of best.run.edges) legs.push(graph.edges[index]);
    remaining.splice(best.j, 1);
    remaining.splice(best.i, 1);
  }
  return { legs, ends: remaining };
}

/** The shortest run of mapped path between two junctions, by ground covered. */
function shortestRun(graph, component, from, to) {
  const meters = new Map([[from, 0]]);
  const arrival = new Map();
  const settled = new Set();
  for (;;) {
    let node = null;
    for (const [candidate, covered] of meters) {
      if (settled.has(candidate)) continue;
      if (node === null || covered < meters.get(node)) node = candidate;
    }
    if (node === null) return null;
    if (node === to) break;
    settled.add(node);
    for (const index of graph.at[node]) {
      const edge = graph.edges[index];
      const next = edge.from === node ? edge.to : edge.from;
      if (next === node) continue;
      const covered = meters.get(node) + edge.meters;
      if (!meters.has(next) || covered < meters.get(next)) {
        meters.set(next, covered);
        arrival.set(next, { index, from: node });
      }
    }
  }
  const edges = [];
  for (let node = to; node !== from; node = arrival.get(node).from) {
    edges.push(arrival.get(node).index);
  }
  return { edges: edges.reverse(), meters: meters.get(to) };
}

/**
 * The order one line walks a group's legs in: Hierholzer's algorithm.
 *
 * Returns the junctions in the order they are reached, each carrying the leg
 * that was walked to reach it. The first carries none, being where the line
 * starts.
 */
function trailFrom(legs, nodeCount, start) {
  const at = Array.from({ length: nodeCount }, () => []);
  legs.forEach((leg, index) => {
    at[leg.from].push(index);
    if (leg.to !== leg.from) at[leg.to].push(index);
  });
  const walked = legs.map(() => false);
  const next = new Array(nodeCount).fill(0);
  const stack = [{ node: start, leg: null }];
  const reached = [];
  while (stack.length) {
    const here = stack[stack.length - 1];
    let take = -1;
    while (next[here.node] < at[here.node].length) {
      const index = at[here.node][next[here.node]];
      if (!walked[index]) { take = index; break; }
      next[here.node] += 1;
    }
    if (take === -1) { reached.push(stack.pop()); continue; }
    walked[take] = true;
    const leg = legs[take];
    stack.push({ node: leg.from === here.node ? leg.to : leg.from, leg: take });
  }
  return reached.reverse();
}

/**
 * The trail's legs as one line of coordinates.
 *
 * Every leg is turned to run from the junction the line is at to the one it
 * reaches next, and that is asserted rather than assumed: a sketch of this
 * measured Seeweg at 30.5 km before the check was added, because a leg drawn
 * the other way round was being walked backwards and the line doubled over
 * itself. A silent 2.6x is the fault worth refusing to ship.
 *
 * The weld between two legs drops the second's first point, as end-to-end
 * stitching did, so where two ends coincide the line has one point and where
 * they sit a few metres apart it has one short step.
 */
function drawTrail(legs, reached) {
  const line = [];
  for (let i = 1; i < reached.length; i += 1) {
    const leg = legs[reached[i].leg];
    const was = reached[i - 1].node;
    const forward = leg.from === was;
    if (!forward && leg.to !== was) {
      throw new Error(`route assembly: a member running ${leg.from}-${leg.to} `
        + `cannot be walked from junction ${was}`);
    }
    const coords = forward ? leg.coords : leg.coords.slice().reverse();
    const ends = forward ? leg.to : leg.from;
    if (ends !== reached[i].node) {
      throw new Error(`route assembly: a member walked from junction ${was} `
        + `arrives at ${ends}, not ${reached[i].node}`);
    }
    for (const point of (line.length ? coords.slice(1) : coords)) line.push(point);
  }
  return line;
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
  // Unrounded, because the share below is a ratio and `pathLengthKm` rounds to
  // a tenth -- which on a short walk is a tenth of the answer.
  let drawnKm = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) drawnKm += haversineMeters(line[i - 1], line[i]);
  }
  drawnKm /= 1000;
  const memberKm = memberLengthKm(members);
  return {
    lines,
    lengthKm,
    // What the members cover, and how much of it the drawn line shows. The
    // caller decides what to do about a shortfall; measuring it is this
    // function's business, because it is the only place that holds both.
    memberKm,
    drawnShare: memberKm > 0 ? drawnKm / memberKm : null,
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

/* ------------------------------------- Reading one relation without Overpass */

const OSM_API = 'https://api.openstreetmap.org/api/0.6';

/**
 * The same answer as `relation(id:…); out geom;`, read from the OSM API.
 *
 * Overpass is the right tool for discovering an area and the wrong one for
 * re-reading a handful of known relations: on 18 October 2026 all four mirrors
 * were down at once -- two 502, one 500, and osm.jp's expired certificate --
 * so the one path whose job is repairing geometry could not run at all. The
 * OSM API serves a single relation and everything under it in one request, and
 * it is the canonical source Overpass itself is built from.
 *
 * `relation/<id>/full.json` returns the relation, its member ways and their
 * nodes as a flat list. Reassembled here into the member shape `out geom`
 * produces, so `geometryOf` and every guard above it are the same code on
 * either transport. Like `out geom`, it does not descend into a member
 * relation; no catalogue relation has one.
 *
 * Exposed as a `fetchQuery`, so it answers the surface query from the way tags
 * the same document already carries, and costs no second round trip.
 */
function osmApiFetchQuery(options = {}) {
  const get = options.fetch || ((url) => fetch(url, { headers: { 'User-Agent': USER_AGENT } }));
  const pause = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const cache = new Map();

  async function relationDocument(id) {
    if (cache.has(id)) return cache.get(id);
    const response = await get(`${OSM_API}/relation/${id}/full.json`);
    if (!response.ok) throw new Error(`OSM API returned HTTP ${response.status} for relation ${id}`);
    const doc = await response.json();
    cache.set(id, doc);
    await pause(400); // The API asks for one request at a time, politely paced.
    return doc;
  }

  return async function fetchQuery(query) {
    // Only the relation clause. Reading every number in the query instead
    // picks up `[out:json][timeout:180]` and asks the API for relation 180.
    const clause = String(query).match(/relation\(\s*(?:id:)?\s*([\d,\s]+?)\s*\)/);
    const ids = clause ? clause[1].split(/[,\s]+/).map(Number).filter(Number.isFinite) : [];
    const wantsSurface = /\["surface"\]/.test(query);
    const elements = [];
    for (const id of [...new Set(ids)]) {
      const doc = await relationDocument(id);
      const nodes = new Map(), ways = new Map();
      let relation = null;
      for (const el of doc.elements || []) {
        if (el.type === 'node') nodes.set(el.id, { lat: el.lat, lon: el.lon });
        else if (el.type === 'way') ways.set(el.id, el);
        else if (el.type === 'relation' && el.id === id) relation = el;
      }
      if (!relation) continue;
      if (wantsSurface) {
        for (const way of ways.values()) {
          if (way.tags?.surface) elements.push({ type: 'way', id: way.id, tags: way.tags });
        }
        continue;
      }
      elements.push({
        type: 'relation', id, tags: relation.tags || {},
        members: (relation.members || []).map((m) => {
          if (m.type !== 'way') return { type: m.type, ref: m.ref, role: m.role };
          const way = ways.get(m.ref);
          return { type: 'way', ref: m.ref, role: m.role,
            geometry: (way?.nodes || []).map((n) => nodes.get(n)).filter(Boolean) };
        }),
      });
    }
    return { elements };
  };
}

/**
 * Why this answer cannot be believed as the walk's geometry, or null.
 *
 * Two questions, both of which have cost the catalogue trails, asked in one
 * place so the full pass and the targeted refresh cannot answer them
 * differently. The refresh used to ask neither, which left the one path whose
 * whole job is repairing geometry free to overwrite a good line with a thin
 * Overpass answer.
 *
 * `built` is optional: the full pass asks the first question before it builds.
 */
function incompleteGeometryReason(members, built) {
  const counted = memberGeometryShare(members);
  if (counted && counted.share < MINIMUM_GEOMETRY_SHARE) {
    return `returned geometry for ${counted.withGeometry}/${counted.ways} ways`;
  }
  if (built && built.drawnShare !== null && built.drawnShare < MINIMUM_DRAWN_SHARE) {
    return `drew ${built.lengthKm} km of the ${Math.round(built.memberKm * 10) / 10} km `
      + `its own members cover (${Math.round(built.drawnShare * 100)}%)`;
  }
  return null;
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
      // A refresh may only improve a line. An answer that cannot account for
      // its own members leaves the feature exactly as it was -- replacing good
      // geometry with a short one is the fault this path exists to repair.
      const why = incompleteGeometryReason(el.members || [], built);
      if (why) { failed.push({ id: el.id, why }); continue; }
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
    const viaOsmApi = ARGS.includes('--via-osm-api');
    console.log(`[refresh] Re-reading the geometry of ${only.length} relation(s); the feature list is left alone.`);
    if (viaOsmApi) console.log('[refresh] Reading from the OSM API rather than Overpass.');
    const result = await refreshGeometry(only, { dryRun: ARGS.includes('--dry-run'),
      ...(viaOsmApi ? { fetchQuery: osmApiFetchQuery() } : {}) });
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
      const counted = memberGeometryShare(el.members);
      if (counted && counted.share < MINIMUM_GEOMETRY_SHARE) {
        console.warn(`[phase2] INCOMPLETE: relation ${el.id} (${match.tags.name}) returned geometry for `
          + `${counted.withGeometry}/${counted.ways} ways; not dropping it on a partial answer.`);
        incomplete.push({ id: el.id, name: match.tags.name,
          ways: counted.ways, withGeometry: counted.withGeometry });
        continue;
      }

      // The geometry and what it decides, from the one definition the targeted
      // refresh also uses, so a refreshed feature and a freshly discovered one
      // cannot disagree.
      const built = geometryOf(el.members, el.tags || match.tags, waySurface);
      if (!built) continue;

      // And the same question again of the line itself. Every member can
      // arrive and the walk still be written short, which is how three Savoy
      // walks were published missing between a fifth and fifteen sixteenths of
      // their length. A line that cannot account for its own members is a
      // failed build, not a shorter walk.
      const shortfall = incompleteGeometryReason(el.members, built);
      if (shortfall) {
        console.warn(`[phase2] INCOMPLETE: relation ${el.id} (${match.tags.name}) ${shortfall};`
          + ' keeping the trail rather than publishing a short line.');
        incomplete.push({ id: el.id, name: match.tags.name,
          ways: counted ? counted.ways : 0, withGeometry: counted ? counted.withGeometry : 0,
          drawnShare: built.drawnShare });
        continue;
      }
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
  OVERPASS_URLS, USER_AGENT, HARD_SAC, MAX_KM, hardWayForDogs, evaluateRelation, buildPhase1Query,
  buildPhase2Query, buildMemberWayQuery,
  OFF_ROUTE_ROLES, STITCH_TOLERANCE_M, COINCIDENT_END_M, isRouteMember, stitchMembers,
  junctionGraph, componentsOf,
  geometryOf, refreshGeometry, simplify, pathLengthKm, isClosedLoop, parseDistanceKm,
  MINIMUM_GEOMETRY_SHARE, MAXIMUM_CATALOGUE_LOSS, readPreviousCatalogue,
  MINIMUM_DRAWN_SHARE, memberGeometryShare, memberLengthKm, incompleteGeometryReason,
  osmApiFetchQuery, OSM_API };
