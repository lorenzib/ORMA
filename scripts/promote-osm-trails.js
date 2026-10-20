#!/usr/bin/env node
'use strict';

/**
 * promote-osm-trails.js
 *
 * Promotes every route in dog-friendly-routes.geojson to a full ORMA trail
 * entry, computing everything that can be honestly derived from verified data:
 *
 *   - path            converted to the site's [lat, lng] convention
 *   - distance        computed from geometry
 *   - elevationProfile + elevation gain   via Open-Meteo elevation API
 *   - safetyLevel / terrainRank           from computed sustained grade
 *   - hours           Naismith's rule estimate
 *   - waterSources    proximity-matched from water-sources-all-regions.geojson
 *   - rifugi          proximity-matched from huts-bars-all-regions.geojson
 *   - area            nearest known Dolomites locality
 *
 * Fields that CANNOT be derived (shade, hazards, paid access, preferred
 * direction, dog-specific notes) are left out or honestly marked unverified.
 * Every entry carries curated:false and its Waymarked Trails link.
 *
 * Output: osm-trails-data.js, loaded AFTER trails-data.js, it appends to the
 * trails array. trails-data.js stays the hand-curated single source of truth
 * and is never touched by this script.
 *
 * NOTE: Open-Meteo is used under its free non-commercial tier (same caveat as
 * the live weather integration).
 */

const fs = require('fs/promises');
const nodeFs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const REGIONS = {
  dolomites: {
    routesFile: 'dog-friendly-routes.geojson',
    accessFile: 'data/access-points.geojson',
    outputFile: 'osm-trails-data.js'
  },
  savoy: {
    routesFile: 'dog-friendly-routes-savoy.geojson',
    accessFile: 'data/access-points-savoy.geojson',
    outputFile: 'osm-trails-savoy-data.js'
  }
};
const args = process.argv.slice(2);
const regionIdx = args.indexOf('--region');
const REGION_KEY = regionIdx !== -1 && args[regionIdx + 1] ? args[regionIdx + 1] : 'dolomites';
const REGION = REGIONS[REGION_KEY];
if (!REGION) {
  console.error(`Unknown --region "${REGION_KEY}". Available: ${Object.keys(REGIONS).join(', ')}`);
  process.exit(1);
}

const ROUTES_PATH = path.join(ROOT, REGION.routesFile);
const WATER_PATH = path.join(ROOT, 'water-sources-all-regions.geojson');
const HUTS_PATH = path.join(ROOT, 'huts-bars-all-regions.geojson');
const OUTPUT_PATH = path.join(ROOT, REGION.outputFile);
// Per region, so a run of one region cannot prune the other's heights.
const ELEVATION_CACHE_PATH = path.join(ROOT, 'data', `elevation-cache-${REGION_KEY}.json`);

const WATER_MATCH_METERS = 150;
const HUT_MATCH_METERS = 250;
const ACCESS_MATCH_METERS = 400;      // access point must be this close to the route
const ELEVATION_BATCH = 100;          // Open-Meteo max per request
const ELEVATION_SAMPLES = 80;         // sampled points per route
const ACCESS_PATH = path.join(ROOT, REGION.accessFile);
// Set by the generated-artifact check, which regenerates this file to compare
// it with the committed one and must not depend on somebody else's server.
const OFFLINE = process.env.ORMA_PROMOTE_OFFLINE === 'true';

// The locality table lives in regions-config.js and is loaded from there. It
// used to be duplicated here; the two copies drifted, so a trail could take its
// `area` from one list and its `valley` from the other and end up naming two
// different places.
const REGIONS_CONFIG_PATH = path.join(ROOT, 'regions-config.js');
let localityApi = null;
function regions() {
  if (!localityApi) {
    const context = { window: {}, console };
    vm.createContext(context);
    vm.runInContext(nodeFs.readFileSync(REGIONS_CONFIG_PATH, 'utf8'), context,
      { filename: 'regions-config.js' });
    localityApi = context.window.DoloPawsRegions;
  }
  return localityApi;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** The widest gap between consecutive points, in metres. */
function widestGapMeters(pts) {
  let widest = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const gap = haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    if (gap > widest) widest = gap;
  }
  return widest;
}

/**
 * Put a relation's pieces in walking order before they become one line.
 *
 * A MultiLineString arrives as however many ways the relation lists, in
 * whatever order it lists them and pointing whichever way they were drawn.
 * Concatenating them as they come put a jump at every join the size of the
 * distance between two unrelated ends -- which is why twenty-one catalogue
 * trails were held back as drafts for "geometry jump", several of them for a
 * gap the route does not actually have.
 *
 * Greedy nearest-end chaining: start from the longest piece, then repeatedly
 * attach whichever remaining piece has an end closest to either free end of
 * the chain, reversing it when that is the closer way round.
 *
 * This reorders and reorients, and drops a piece that is not worth reaching.
 * It never merges or invents a point, so a genuine hole in the data still
 * reads as a gap of its true size.
 *
 * NOT WORTH REACHING: a piece whose gap to the chain is longer than the piece
 * itself. Gsieser Talblickweg lists 160 ways that fall into eighteen groups --
 * the walk, and then thirteen fragments of ten to a hundred and fifty metres
 * scattered up to ten kilometres down the valley. Chaining those drew 8.8 km
 * of line across open ground to collect about half a kilometre of path. No
 * walker gains anything from a stretch that costs more to reach than it is
 * long, and the drawn line stops describing the walk.
 *
 * Conservative on purpose, in two ways. A 200 m spur reached across 50 m is
 * kept, because the gap is the smaller of the two. And nothing longer than
 * DROPPABLE_PIECE_M goes at all, whatever the gap: the chain starts from the
 * piece with the most points rather than the most ground, so without that
 * ceiling a long sparse line could take the lead and see the real walk
 * discarded behind it. Across the twenty discontinuous catalogue trails the
 * largest piece this drops is 638 m and thirty-three of the thirty-four are
 * under 250 m, so the ceiling costs nothing real and forecloses the bad case.
 *
 * `dropped` reports them rather than losing them silently, and `connectors`
 * reports each straight line this drew between two pieces -- where it lands in
 * the path, and how long it is. Those are holes in the map rather than ground
 * anybody walks, which is why the length a trail publishes leaves them out.
 */
function chainLines(lines) {
  const remaining = lines
    .map(line => line.map(([lng, lat]) => [lat, lng]))
    .filter(piece => piece.length)
    .sort((a, b) => b.length - a.length);
  if (!remaining.length) return { path: [], dropped: [], connectors: [] };

  // A walk that returns to where it started is already whole -- but only when
  // what that leaves out is debris.
  //
  // Where the biggest piece closes on itself, the rest of the relation is
  // usually a few stray metres: a kerb, a spur into a car park, a duplicated
  // node. Chaining those in drew a line across open country and called the
  // result one walk, so they are set aside instead.
  //
  // What this must not do is set aside the walk. The first version of this
  // rule dropped whatever was left however big it was, and measured against
  // the relations' own member ways in OSM it was shortening real routes:
  // Albannette petite boucle is 5.01 km by its distance tag and by its ways
  // and came out 2.98 km; Colombier is 10.16 km and came out 6.76 km; Seeweg
  // is 11.75 km and came out 8.39 km. In each the discarded stretch was part
  // of the route, not somewhere else -- Seeweg's touches the loop.
  //
  // So the shortcut is taken only when every piece left out would already be
  // droppable while chaining: small in itself, and small against the loop. A
  // walk that leaves out more than that is chained as normal, and the widest
  // gap it ends up with is then judged by the publication rules like any
  // other -- which is how a route whose line is genuinely missing ends up
  // held back rather than published short.
  //
  // Judged on the piece covering the most ground, not the most points: a
  // sparse long line and a dense short one are easy to confuse by point count.
  const byGround = remaining.slice().sort((a, b) => lineMeters(b) - lineMeters(a));
  const biggest = byGround[0];
  const loopMeters = lineMeters(biggest);
  const setAside = byGround.slice(1);
  const setAsideMeters = setAside.reduce((total, piece) => total + lineMeters(piece), 0);
  const onlyDebrisLeftOut = setAside.every((piece) => lineMeters(piece) <= DROPPABLE_PIECE_M)
    && setAsideMeters < loopMeters * DROPPABLE_SHARE_OF_WALK;
  if (remaining.length > 1 && loopMeters > 0 && onlyDebrisLeftOut
    && haversineMeters(biggest[0][0], biggest[0][1],
      biggest[biggest.length - 1][0], biggest[biggest.length - 1][1]) <= LOOP_CLOSE_M) {
    return {
      path: biggest,
      dropped: setAside.map((piece) => ({
        meters: Math.round(lineMeters(piece)), points: piece.length, reason: 'detached from a closed loop',
      })),
      connectors: [],   // the loop is one piece, so nothing was drawn across
    };
  }

  let chained = remaining.shift();
  const dropped = [];
  const connectors = [];
  while (remaining.length) {
    let best = null;
    for (let i = 0; i < remaining.length; i += 1) {
      const piece = remaining[i];
      const head = piece[0];
      const tail = piece[piece.length - 1];
      const options = [
        { gap: haversineMeters(chained[chained.length - 1][0], chained[chained.length - 1][1], head[0], head[1]), i, reverse: false, append: true },
        { gap: haversineMeters(chained[chained.length - 1][0], chained[chained.length - 1][1], tail[0], tail[1]), i, reverse: true, append: true },
        { gap: haversineMeters(chained[0][0], chained[0][1], tail[0], tail[1]), i, reverse: false, append: false },
        { gap: haversineMeters(chained[0][0], chained[0][1], head[0], head[1]), i, reverse: true, append: false },
      ];
      for (const option of options) if (!best || option.gap < best.gap) best = option;
    }
    const piece = remaining[best.i];
    const pieceMeters = lineMeters(piece);
    const chainMeters = lineMeters(chained);
    if (best.gap > pieceMeters
      && pieceMeters <= DROPPABLE_PIECE_M
      && pieceMeters < chainMeters * DROPPABLE_SHARE_OF_WALK) {
      dropped.push({ meters: Math.round(pieceMeters), gap: Math.round(best.gap), points: piece.length });
      remaining.splice(best.i, 1);
      continue;
    }
    const oriented = best.reverse ? piece.slice().reverse() : piece;
    // Record the join as well as making it. `best.gap` is the distance between
    // the two points that are about to become neighbours, so the connector is
    // the segment ending at the first point of whichever side was added.
    if (best.append) {
      connectors.push({ index: chained.length, meters: best.gap });
      chained = chained.concat(oriented);
    } else {
      // Prepending slides everything already chained further along the path.
      for (const connector of connectors) connector.index += oriented.length;
      connectors.push({ index: oriented.length, meters: best.gap });
      chained = oriented.concat(chained);
    }
    remaining.splice(best.i, 1);
  }
  return { path: chained, dropped, connectors };
}

// The most ground a piece may cover and still be discardable. Above this it is
// kept whatever it costs to reach, because a piece that long is a part of the
// walk that someone mapped badly, not litter.
const DROPPABLE_PIECE_M = 1000;

// How near a piece's two ends must be before it counts as returning to its
// start. The same figure stitching uses: if the ends are close enough that two
// separate ways would have been joined there, the line has closed.
const LOOP_CLOSE_M = 100;

// And it must be small against the walk it is being dropped from. Two 400 m
// fragments fifteen kilometres apart are not a walk with litter on it, they
// are a relation with nothing usable in it -- dropping one would publish a
// tidy-looking 400 m route where the honest outcome is a visible hole and a
// draft. A fragment only goes when there is plainly a walk for it to be litter
// beside.
const DROPPABLE_SHARE_OF_WALK = 0.1;

/** Walked length of a [lat, lng] line, in metres. */
function lineMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return total;
}

// Flatten a (Multi)LineString into one [lat, lng] path, plus cumulative km.
function toPath(geometry) {
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  const asListed = [];
  // The file's own order has connectors too: it lays the pieces nose to tail,
  // so wherever one ends and the next begins there is a straight line across
  // whatever lies between them.
  const asListedConnectors = [];
  for (const line of lines) {
    if (asListed.length && line.length) {
      const from = asListed[asListed.length - 1];
      const [lng, lat] = line[0];
      asListedConnectors.push({ index: asListed.length,
        meters: haversineMeters(from[0], from[1], lat, lng) });
    }
    for (const [lng, lat] of line) asListed.push([lat, lng]);
  }
  // Greedy chaining is a heuristic, and on one catalogue relation it picked an
  // order fractionally worse than the one the file already had. So the two are
  // compared and the better kept: this step can narrow a route's widest gap
  // and can never widen it, which is the property that makes it safe to run
  // over the whole catalogue rather than the trails known to be broken.
  const chaining = lines.length > 1 ? chainLines(lines)
    : { path: asListed, dropped: [], connectors: [] };
  const chained = chaining.path;
  // The as-listed order is still the fallback when chaining cannot better it,
  // but it carries every fragment, so preferring it would put back the pieces
  // chaining has just refused. Chaining wins on a tie for that reason.
  const useChained = chained.length > 0
    && (chaining.dropped.length > 0 || widestGapMeters(chained) <= widestGapMeters(asListed));
  const pts = useChained ? chained : asListed;
  const connectors = useChained ? chaining.connectors : asListedConnectors;
  return { pts, cumKm: recomputeCumKm(pts, connectors), connectors, segments: lines.length,
    droppedPieces: useChained ? chaining.dropped : [] };
}

function sampleAlong(pts, cumKm, count) {
  if (pts.length <= count) return pts.map((p, i) => ({ lat: p[0], lng: p[1], km: cumKm[i] }));
  const total = cumKm[cumKm.length - 1];
  const out = [];
  let idx = 0;
  for (let s = 0; s < count; s += 1) {
    const target = (total * s) / (count - 1);
    while (idx < cumKm.length - 1 && cumKm[idx] < target) idx += 1;
    out.push({ lat: pts[idx][0], lng: pts[idx][1], km: cumKm[idx] });
  }
  return out;
}

/**
 * The ground height at one sampled point, keyed the way it is asked for.
 *
 * The request already rounds to five decimals -- about a metre -- so that
 * string is the natural key, and the same point in two routes is one lookup.
 */
function elevationKey(sample) {
  return `${sample.lat.toFixed(5)},${sample.lng.toFixed(5)}`;
}

/**
 * Ground height does not change, so it is asked for once and kept.
 *
 * Every run queried Open-Meteo for all 80 samples of all 163 routes, which is
 * about 150 requests a region, and the free tier answers some of them with 429.
 * A failed fetch silently leaves the route with no profile, so a rate-limited
 * run quietly produces worse data than the one before it: regenerating the
 * catalogue on 16 October took two full passes and a merge of the two to end up
 * with no profile lost, because each pass dropped a different handful.
 *
 * With the heights on disk a second run asks for nothing, which makes a
 * regeneration cheap, repeatable and immune to the rate limit. The cache is
 * per region and holds exactly the points that region's run asked for, so it
 * cannot grow stale behind a geometry change -- a corrected line's old samples
 * simply stop being requested and stop being written.
 */
function loadElevationCache(file) {
  try {
    const stored = JSON.parse(nodeFs.readFileSync(file, 'utf8'));
    const points = stored && typeof stored.points === 'object' ? stored.points : {};
    // A height is a finite number of metres or it is not a height.
    return new Map(Object.entries(points).filter(([, value]) => Number.isFinite(value)));
  } catch {
    return new Map();
  }
}

/**
 * Which points a save should write.
 *
 * A save part-way through a run must MERGE, or it deletes the heights of the
 * routes this run has not reached yet and an interrupted run leaves a smaller
 * cache than it started with. Only the save at the end prunes, because only
 * then is the used set the whole live set and stale points should go.
 */
function cachePointsToSave(loaded, used, { prune = false } = {}) {
  return prune ? new Map(used) : new Map([...(loaded || []), ...(used || [])]);
}

async function saveElevationCache(file, used) {
  const points = Object.fromEntries([...used].sort(([a], [b]) => a.localeCompare(b)));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify({
    contractVersion: '1.0.0', generatedAt: new Date().toISOString(),
    note: 'Ground height per sampled point, from Open-Meteo. Keyed lat,lng to five decimals.',
    points,
  }, null, 0)}\n`);
}

/**
 * Heights for every sample, from the cache where possible.
 *
 * Returns null if any height could not be had, exactly as before: a profile
 * with holes in it would be worse than no profile, and the caller already
 * treats null as "keep the trail, drop the elevation".
 */
/**
 * Ground height, from the cache, and from Open-Meteo for anything new.
 *
 * `offline` says the cache is all there is. The staleness check regenerates
 * this file in CI to compare it with the committed one, and a check that
 * reaches the internet is a check that fails when somebody else's server is
 * down. With every point on file it needs nothing; when a point is missing,
 * saying so beats quietly fetching it on a machine that may have no network
 * and then reporting the file as stale.
 */
async function fetchElevations(samples, options = {}) {
  const cache = options.cache || new Map();
  const found = options.found || new Map();
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || (ms => new Promise((r) => setTimeout(r, ms)));
  // Open-Meteo's maximum per request, lowered only by a test that needs more
  // than one batch out of a handful of points.
  const batchSize = options.batchSize || ELEVATION_BATCH;

  const heights = new Map();
  const missing = [];
  // A loop's first and last sample are the same place, so the same point can
  // appear more than once in one route and must still be asked for once.
  const queued = new Set();
  for (const sample of samples) {
    const key = elevationKey(sample);
    if (cache.has(key)) { heights.set(key, cache.get(key)); continue; }
    if (queued.has(key)) continue;
    queued.add(key);
    if (options.offline) {
      throw new Error(`No height on file for ${key} and ORMA_PROMOTE_OFFLINE is set. `
        + 'Run `npm run promote:trails` locally and commit data/elevation-cache-*.json.');
    }
    missing.push(sample);
  }

  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const url = 'https://api.open-meteo.com/v1/elevation'
      + `?latitude=${batch.map((p) => p.lat.toFixed(5)).join(',')}`
      + `&longitude=${batch.map((p) => p.lng.toFixed(5)).join(',')}`;
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt += 1) {
      try {
        const res = await fetchImpl(url, { headers: { 'user-agent': 'ORMA-trail-builder/1.0 (+https://www.app-orma.com)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const values = data?.elevation;
        // One height per point asked for, or the two lists cannot be lined up
        // and every height after the gap would belong to the wrong place.
        if (!Array.isArray(values) || values.length !== batch.length) {
          throw new Error(`asked for ${batch.length} heights and got ${Array.isArray(values) ? values.length : 'none'}`);
        }
        batch.forEach((sample, index) => {
          heights.set(elevationKey(sample), values[index]);
          // Kept the moment it arrives, not when the route finishes. A height
          // is true whether or not the rest of the route could be fetched, and
          // discarding it would make a rate-limited run contribute nothing --
          // the whole point is that repeated runs converge on a full cache
          // instead of each starting over.
          if(Number.isFinite(values[index])) found.set(elevationKey(sample), values[index]);
        });
        ok = true;
      } catch (err) {
        console.warn(`[elev] attempt ${attempt} failed: ${err.message}`);
        if (attempt < 3) await sleep(3000 * attempt);
      }
    }
    if (!ok) break; // nothing more to ask for; the route gives up below
    if (i + batchSize < missing.length) await sleep(250);
  }

  const elevations = samples.map((sample) => heights.get(elevationKey(sample)));
  if (elevations.some((value) => !Number.isFinite(value))) return null;
  // The heights read from the cache count as used too, or the next run would
  // refetch whatever this one did not have to ask for.
  for (const sample of samples) {
    const key = elevationKey(sample);
    found.set(key, heights.get(key));
  }
  return elevations;
}

function buildProfile(samples, elevations, totalKm) {
  // Reduce to ~12 evenly spaced profile points for the chart.
  const step = Math.max(1, Math.floor(samples.length / 12));
  const profile = [];
  for (let i = 0; i < samples.length; i += step) {
    profile.push({ km: Math.round(samples[i].km * 10) / 10, elev: Math.round(elevations[i]) });
  }
  const last = samples.length - 1;
  if (profile[profile.length - 1].km !== Math.round(samples[last].km * 10) / 10) {
    profile.push({ km: Math.round(totalKm * 10) / 10, elev: Math.round(elevations[last]) });
  }
  return profile;
}

function median3(values) {
  // Kills single-sample elevation-API spikes without flattening real slopes.
  if (values.length < 3) return values.slice();
  const out = values.slice();
  for (let i = 1; i < values.length - 1; i += 1) {
    out[i] = [values[i - 1], values[i], values[i + 1]].sort((a, b) => a - b)[1];
  }
  return out;
}

function computeGainAndGrade(samples, elevations) {
  // SUSTAINED grade, not point-max. The old point-max (any ~50 m segment
  // ≥18%) rated two-thirds of the catalog Caution, one short ramp tarred
  // whole family loops. A safety rating should describe what the trail
  // sustains, so:
  //   1. median-3 smoothing (elevation-API spikes: real trails don't drop
  //      97 m and climb back in 300 m),
  //   2. grade measured over 0.25–0.8 km windows only,
  //   3. windows must exceed a 30 m noise floor AND be credible, no
  //      segment can rise/fall more than the whole trail does,
  //   4. backstop: the trail-wide average grade, so long uniform ramps
  //      (steep on average, never extreme in one window) still rate honestly.
  let gain = 0;
  const smoothed = median3(elevations);
  for (let i = 1; i < smoothed.length; i += 1) {
    const dElev = smoothed[i] - smoothed[i - 1];
    if (dElev > 2) gain += dElev; // ignore sub-noise wiggles
  }
  gain = Math.round(gain);

  const net = Math.abs(smoothed[smoothed.length - 1] - smoothed[0]);
  const maxCredible = gain + net + 25;
  let maxGrade = 0;
  for (let i = 0; i < smoothed.length; i += 1) {
    for (let j = i + 1; j < smoothed.length; j += 1) {
      const dKm = samples[j].km - samples[i].km;
      if (dKm < 0.25) continue;
      if (dKm > 0.8) break;
      const dz = Math.abs(smoothed[j] - smoothed[i]);
      if (dz < 30 || dz > maxCredible) continue;
      maxGrade = Math.max(maxGrade, dz / (dKm * 1000));
    }
  }
  const totalKm = samples[samples.length - 1].km;
  if (totalKm > 0) maxGrade = Math.max(maxGrade, gain / (totalKm * 1000));

  return { gain, maxGrade };
}

function rateSafety(maxGrade) {
  // Sustained grade thresholds; conservative because unverified.
  if (maxGrade < 0.10) return { safetyLevel: 'low-risk', terrainRank: 0 };
  if (maxGrade < 0.18) return { safetyLevel: 'moderate', terrainRank: 1 };
  return { safetyLevel: 'caution', terrainRank: 2 };
}

/**
 * "A" or "an", decided by how the number is said.
 *
 * This keyed off whether the walk was a loop -- "A 2.2 km loop", "An 1.5 km
 * route" -- which has nothing to do with the article, and 42 of the 124
 * imported descriptions read wrongly on live pages: "An 3 km route", "An 0.7
 * km route", "A 11.1 km loop".
 *
 * Said aloud, only eight, eleven, eighteen and the eighties begin with a vowel
 * sound, and the decimals do not change it -- "an eight point four km loop" --
 * so the whole-kilometre part decides. A leading-digit rule is not enough: 110
 * is "a hundred and ten", not "an eleven".
 *
 * Stated over the range this field can hold: the longest walk in the catalogue
 * is 71 km and the publication limit is 50, so above 99 this answers "a",
 * which is right for every hundred except the eight hundreds.
 */
function articleFor(km) {
  const whole = Math.floor(Math.abs(Number(km) || 0));
  return whole === 8 || whole === 11 || whole === 18 || (whole >= 80 && whole <= 89) ? 'An' : 'A';
}

function naismithHours(km, gainM) {
  const h = km / 4.5 + gainM / 600;
  const lo = Math.max(0.5, Math.round(h * 2) / 2);
  const hi = Math.round((h * 1.3) * 2) / 2;
  return hi > lo ? `${fmtH(lo)}–${fmtH(hi)}` : `${fmtH(lo)}`;
  function fmtH(v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); }
}

// Spatial grid index so 178 routes x 28k POIs stays fast.
function buildIndex(features, cell = 0.01) {
  const grid = new Map();
  for (const f of features) {
    if (!f.geometry) continue;
    const [lng, lat] = f.geometry.type === 'Point'
      ? f.geometry.coordinates
      : (f.geometry.coordinates[0][0] ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0]);
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push({ lat, lng, props: f.properties || {} });
  }
  return { grid, cell };
}

function nearIndex(index, lat, lng) {
  const { grid, cell } = index;
  const r = Math.floor(lat / cell);
  const c = Math.floor(lng / cell);
  const out = [];
  for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
    const bucket = grid.get(`${r + dr}:${c + dc}`);
    if (bucket) out.push(...bucket);
  }
  return out;
}

function matchAlongPath(pts, cumKm, index, maxMeters, labelFn) {
  const found = new Map(); // dedupe by POI identity
  for (let i = 0; i < pts.length; i += 2) {
    for (const poi of nearIndex(index, pts[i][0], pts[i][1])) {
      const d = haversineMeters(pts[i][0], pts[i][1], poi.lat, poi.lng);
      if (d <= maxMeters) {
        const id = `${poi.lat.toFixed(5)},${poi.lng.toFixed(5)}`;
        const km = Math.round(cumKm[i] * 10) / 10;
        if (!found.has(id) || found.get(id).km > km) {
          found.set(id, {
            km,
            lat: poi.lat,
            lng: poi.lng,
            ...(poi.props['@id'] ? { osmId: poi.props['@id'] } : {}),
            ...labelFn(poi)
          });
        }
      }
    }
  }
  return [...found.values()].sort((a, b) => a.km - b.km);
}

function nearestLocality(lat, lng) {
  return regions().nearestLocality(lat, lng).name;
}

/* ---------------- Verified start points, orientation, terrain, direction --- */

// Find the access point (parking / lift / bus stop) closest to the route,
// and the path vertex closest to it.
function findBestAccess(pts, accessIndex) {
  let best = null;
  for (let i = 0; i < pts.length; i += 2) {
    for (const ap of nearIndex(accessIndex, pts[i][0], pts[i][1])) {
      const d = haversineMeters(pts[i][0], pts[i][1], ap.lat, ap.lng);
      if (d <= ACCESS_MATCH_METERS && (!best || d < best.dist)) {
        best = { dist: Math.round(d), vertexIndex: i, ap };
      }
    }
  }
  return best;
}

// Rotate a closed-loop path so it starts at the given vertex.
function rotateLoop(pts, startIndex) {
  if (startIndex === 0) return pts;
  const rotated = pts.slice(startIndex).concat(pts.slice(1, startIndex + 1));
  return rotated;
}

/**
 * Distance along the walk, with the straight lines chaining drew counting as
 * nothing.
 *
 * A connector is a hole in the OSM mapping that `chainLines` bridged so the
 * route reads as one line. Nobody walks it, so it is not distance. Counting it
 * published Seeweg at 14.8 km against 11.75 km of member ways, and would have
 * published Albannette petite boucle at 6.2 km against 5.01 km.
 *
 * This is the one km axis in the script, so correcting it here corrects every
 * reader of it at once: the length the page shows, the km axis of the elevation
 * profile, where a fountain or a rifugio is said to be, and the Naismith
 * estimate. They stay in step because they are all the same number, and the
 * profile's last point is the distance the page publishes by construction.
 *
 * What stays geometric is everything about the drawn line rather than the walk:
 * `widestGapMeters`, and so the publication gate that holds back a route whose
 * line visibly jumps.
 */
function recomputeCumKm(pts, connectors = []) {
  // The index arithmetic in `chainLines` is the only thing between a hole in
  // the map and a wrong published length, so it is checked rather than
  // trusted: each connector must still be the segment it claims to be.
  const drawn = new Set();
  for (const connector of connectors) {
    const from = pts[connector.index - 1];
    const to = pts[connector.index];
    if (!from || !to) {
      throw new Error(`connector ${connector.index} is not a segment of a ${pts.length}-point path`);
    }
    const measured = haversineMeters(from[0], from[1], to[0], to[1]);
    if (Math.abs(measured - connector.meters) > 1) {
      throw new Error(`connector ${connector.index} measures ${Math.round(measured)} m `
        + `but was recorded as ${Math.round(connector.meters)} m`);
    }
    drawn.add(connector.index);
  }
  const cumKm = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const segmentKm = drawn.has(i) ? 0
      : haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) / 1000;
    cumKm.push(cumKm[i - 1] + segmentKm);
  }
  return cumKm;
}

/**
 * Where the connectors are once the whole path has been turned round.
 *
 * Reversing moves the point at `i` to `pts.length - 1 - i`, so the segment
 * ending at `index` ends at `pts.length - index` instead.
 */
function reverseConnectors(connectors, pointCount) {
  return connectors.map((connector) => ({ ...connector, index: pointCount - connector.index }));
}

function accessLabel(best, isLoop) {
  const kindLabel = best.ap.props.kind === 'parking' ? 'Parking'
    : best.ap.props.kind === 'lift station' ? 'Lift station' : 'Bus stop';
  const name = best.ap.props.name ? ` ${best.ap.props.name}` : '';
  return `Start here — ${kindLabel}${name}, ${best.dist} m from the route (OSM-verified access point)`;
}

// Human terrain description from OSM surface tags (km per surface).
const SURFACE_LABELS = {
  gravel: 'gravel', fine_gravel: 'fine gravel', compacted: 'compacted gravel',
  asphalt: 'paved', paved: 'paved', concrete: 'paved', paving_stones: 'paved',
  'concrete:plates': 'paved', sett: 'stone setts', cobblestone: 'cobblestone',
  unhewn_cobblestone: 'cobblestone', pebblestone: 'pebblestone',
  ground: 'natural ground', dirt: 'dirt', earth: 'dirt', grass: 'grass',
  rock: 'rock', stone: 'rock', gravel_turf: 'gravel-turf', unpaved: 'unpaved',
  sand: 'sand', wood: 'boardwalk', woodchips: 'woodchips', metal: 'metal walkway',
  mud: 'mud'
};

function describeTerrain(surfaces, totalKm) {
  if (!surfaces) return { text: 'Surface not yet field-verified', rocky: false, coverage: 0 };
  const grouped = {};
  let taggedKm = 0;
  for (const [key, km] of Object.entries(surfaces)) {
    // Unknown values are mapper free-text ("una", typos, local slang), // bucket them honestly instead of parroting garbage into the UI.
    const label = SURFACE_LABELS[key] || 'other surfaces';
    grouped[label] = (grouped[label] || 0) + km;
    taggedKm += km;
  }
  // Surface tags with ~zero measured length would divide by zero ("NaN%"), // treat them the same as having no usable surface data at all.
  if (taggedKm <= 0.01) return { text: 'Surface not yet field-verified', rocky: false, coverage: 0 };
  const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3).map(([label, km]) => `${label} (${Math.round((km / taggedKm) * 100)}%)`);
  const coverage = Math.min(1, taggedKm / Math.max(totalKm, 0.1));
  const prefix = coverage >= 0.75 ? '' : coverage >= 0.4 ? 'Partially mapped: ' : 'Sparsely mapped: ';
  return {
    text: `${prefix}${top.join(', ')}, from OSM surface data`,
    rocky: sorted.some(([label], idx) => idx < 2 && (label === 'rock' || label === 'mud')),
    coverage
  };
}

// For loops with elevation data: does the route climb more gently as-is or
// reversed? Returns { reverse: bool, note: string }, computed, not opinion.
function pickGentlerDirection(samples, elevations) {
  const grade = (dir) => {
    let maxG = 0;
    const n = samples.length;
    for (let i = 1; i < n; i += 1) {
      const a = dir === 1 ? i - 1 : n - i;
      const b = dir === 1 ? i : n - 1 - i;
      const dElev = elevations[b] - elevations[a];
      const dKm = Math.abs(samples[b].km - samples[a].km);
      if (dElev > 0 && dKm > 0.05) maxG = Math.max(maxG, dElev / (dKm * 1000));
    }
    return maxG;
  };
  const fwd = grade(1);
  const rev = grade(-1);
  if (rev < fwd * 0.85) {
    return { reverse: true, note: 'Direction shown climbs more gradually (computed from elevation data).' };
  }
  if (fwd < rev * 0.85) {
    return { reverse: false, note: 'Direction shown climbs more gradually (computed from elevation data).' };
  }
  return { reverse: false, note: null }; // symmetric, no recommendation
}

async function main() {
  const routes = JSON.parse(await fs.readFile(ROUTES_PATH, 'utf8'));
  const water = JSON.parse(await fs.readFile(WATER_PATH, 'utf8'));
  const huts = JSON.parse(await fs.readFile(HUTS_PATH, 'utf8'));
  let accessIndex = null;
  try {
    const access = JSON.parse(await fs.readFile(ACCESS_PATH, 'utf8'));
    accessIndex = buildIndex(access.features);
    console.log(`[promote] ${access.features.length} access points loaded.`);
  } catch {
    console.warn('[promote] No access-points.geojson, start points fall back to route geometry.');
  }

  // Ground height does not change, so last run's answers are this run's.
  const elevationCache = loadElevationCache(ELEVATION_CACHE_PATH);
  const elevationUsed = new Map();
  // Saved as the run goes, not only at the end.
  //
  // A full pass is 93 routes and several minutes against an API that answers
  // some requests with 429. Writing once at the end means a run killed at
  // route 81 saves nothing and the next one starts from cold -- which is
  // exactly what happened, and it defeats the point of a cache that is
  // supposed to converge across runs.
  //
  // A part-way save MERGES with what was already on file: pruning to the
  // points used so far would delete the heights belonging to routes this run
  // has not reached yet, so an interrupted run would shrink the cache. Only
  // the save at the end prunes, because only then is the used set the live one.
  const bank = async ({ prune = false } = {}) => {
    if(!elevationUsed.size) return;
    const points = cachePointsToSave(elevationCache, elevationUsed, { prune });
    await saveElevationCache(ELEVATION_CACHE_PATH, points);
    return points.size;
  };
  let interrupted = false;
  for(const signal of ['SIGINT', 'SIGTERM']){
    process.once(signal, async () => {
      if(interrupted) return;
      interrupted = true;
      const size = await bank();
      console.log(`\n[elev] Interrupted by ${signal}; kept ${size || 0} point(s) -> ${ELEVATION_CACHE_PATH}`);
      process.exit(130);
    });
  }
  console.log(elevationCache.size
    ? `[elev] ${elevationCache.size} point(s) already on file; only new ones are fetched.`
    : '[elev] No heights on file yet; this run fills the cache.');

  const waterIndex = buildIndex(water.features);
  const hutIndex = buildIndex(huts.features.filter((f) =>
    (f.properties || {}).name && /alpine_hut|wilderness_hut|restaurant|cafe|bar/.test(
      `${f.properties.tourism || ''}|${f.properties.amenity || ''}`)));

  console.log(`[promote] ${routes.features.length} routes to promote.`);
  const entries = [];

  // Relations excluded from import. Two reasons, marked per entry:
  // - verified: hand-verified and moved into trails-data.js (skip = no duplicate)
  // - BANNED: dogs are not allowed on the ground (protected areas etc.), //   these must never appear on a dog-trail site, imported or otherwise.
  const PROMOTED_RELATIONS = new Set([
    3982382, // Circuit Béatrice de Savoie, verified 2026-07-14
    6250300, // Boucle du Lac Vert (Passy), verified 2026-07-14
    9933643, // Le Lac Vert (La Plagne), verified 2026-07-14
    10116283, // Itinéraire de découverte historique (Plateau des Glières), verified 2026-07-14
    10116380, // Itinéraire découverte de la nature (Plateau des Glières), verified 2026-07-14
    20347406, // Sentier des Patriotes (Plateau des Glières), verified 2026-07-14
    11517208, // La Croix des Salles (Megève/Combloux), verified 2026-07-14
    14987412, // Sentier du Four (Arbusigny), enriched import in trails-data.js, still curated:false
    18055492, // Le Mont d'Arbois - Mont Joux (Megève), verified 2026-07-14
    14864704, // Boucle du Taillefer (Duingt), verified 2026-07-14
    20302682, // BANNED: Sentier découverte de Bellevaux (Bauges), inside RNCFS des Bauges, dogs prohibited even on leash (removed 2026-07-14)
    14095296, // Les Marais d'Albens (Entrelacs), verified 2026-07-14
    16322228, // Boucle du Marais des Chassettes (Challes-les-Eaux), verified 2026-07-14
    16363583, // Le Marais de Pré Lombard (La Motte-Servolex), verified 2026-07-14, loop rebuilt
    16395076, // Boucle du Lac de la Thuile, verified 2026-07-14
    19153189, // Le Belvédère (Saint-Pierre-d'Albigny), verified 2026-07-14
    15591346, // Sentier des Buis (Montmélian), verified 2026-07-14
    16365005, // La Galoppaz par la Combe Servenne, enriched import, curated:false, loop rebuilt
    16395059, // REMOVED: Colombier par la Fullie et la Cochette, fiches strongly advise against dogs even leashed (patous, exposed ridge); removed 2026-07-14
    // UNVERIFIABLE: no route number, no waymark, no official page and no operator
    // -- nothing names these routes authoritatively, so they can never clear the
    // route-guidance gate. Retired 2026-09-15 after assessing all 165. Note this
    // is NOT a safety judgement: dogs are fine on all three, unlike the BANNED
    // and REMOVED entries above.
    12079333, // Giro dei Masi (Brenta), retired 2026-09-15
    15662134, // Sagenweg Laurein (Val di Non), retired 2026-09-15
    12211260, // Plateau des Moises (Chablais), retired 2026-09-15
  ]);

  for (const [n, feature] of routes.features.entries()) {
    const p = feature.properties;
    if (PROMOTED_RELATIONS.has(Number(p.osm_relation))) {
      console.log(`[promote] Skipping ${p.name} (${p.osm_relation}), already verified in trails-data.js.`);
      continue;
    }
    const isLoop = p.loop === true || p.loop === 'true';
    let { pts, segments, connectors } = toPath(feature.geometry);
    let cumKm = recomputeCumKm(pts, connectors);

    // --- Verified start point: anchor to the nearest real access point ---
    let startLabel = 'Route start per OpenStreetMap — best parking/access not yet verified';
    // Rotating a loop or turning a line round would scramble the connector
    // indices, and neither helper keeps them. A one-piece geometry has no
    // connectors, which is why this is safe -- stated as a condition rather
    // than left as an assumption, so relaxing the one does not break the other.
    if (accessIndex && segments === 1 && !connectors.length) {
      const best = findBestAccess(pts, accessIndex);
      if (best) {
        if (isLoop) {
          pts = rotateLoop(pts, best.vertexIndex);         // loop now begins at the access point
        } else if (best.vertexIndex > pts.length / 2) {
          pts = pts.slice().reverse();                     // start the line from the accessible end
        }
        cumKm = recomputeCumKm(pts, connectors);
        startLabel = accessLabel(best, isLoop);
      }
    }

    const totalKm = Math.round(cumKm[cumKm.length - 1] * 10) / 10;
    const samples = sampleAlong(pts, cumKm, ELEVATION_SAMPLES);

    console.log(`[promote] ${n + 1}/${routes.features.length} ${p.name} (${totalKm} km)…`);
    const elevations = await fetchElevations(samples,
      { cache: elevationCache, found: elevationUsed, offline: OFFLINE });
    if((n + 1) % 20 === 0) await bank();

    let elevationProfile = null;
    let gain = null;
    let directionNote = null;
    let rating = { safetyLevel: 'moderate', terrainRank: 1 }; // conservative default if elevation unavailable
    if (elevations && elevations.length === samples.length) {
      // --- Recommended direction for loops: the gentler climb, computed ---
      if (isLoop) {
        const dir = pickGentlerDirection(samples, elevations);
        if (dir.reverse) {
          pts = pts.slice().reverse();
          connectors = reverseConnectors(connectors, pts.length);
          cumKm = recomputeCumKm(pts, connectors);
          // Even sampling is symmetric, so reversed elevations line up with
          // freshly sampled points on the reversed path.
          const fresh = sampleAlong(pts, cumKm, ELEVATION_SAMPLES);
          samples.length = 0; samples.push(...fresh);
          elevations.reverse();
        }
        directionNote = dir.note;
      }
      elevationProfile = buildProfile(samples, elevations, totalKm);
      const g = computeGainAndGrade(samples, elevations);
      gain = g.gain;
      rating = rateSafety(g.maxGrade);
    }

    // --- Terrain from OSM surface tags ---
    const terrain = describeTerrain(p.surfaces, totalKm);
    if (terrain.rocky && rating.terrainRank < 2) rating.terrainRank += 1;

    const waterSources = matchAlongPath(pts, cumKm, waterIndex, WATER_MATCH_METERS,
      (poi) => ({ label: poi.props.name || 'Drinking water (OSM-verified location)' }));
    const rifugi = matchAlongPath(pts, cumKm, hutIndex, HUT_MATCH_METERS,
      (poi) => ({ name: poi.props.name }));
    const entry = {
      id: `osm-${p.osm_relation}`,
      source: 'osm', curated: false,
      osmRelation: p.osm_relation,
      waymarkedtrails: p.waymarkedtrails,
      ...(p.ref && /^(?:[A-Za-z]{1,4}-?)?\d{1,4}[A-Za-z]?$/.test(String(p.ref).trim().replace(/\s+/g, ''))
        ? { routeRefs:[String(p.ref).trim().toUpperCase().replace(/\s+/g, '')], routeNumberStatus:'mapped-relation-ref' }
        : { routeNumberStatus:'not-listed-in-mapped-source' }),
      routeNumberSource: {
        provider:'Waymarked Trails / OpenStreetMap',
        name:p.name || null,
        url:p.waymarkedtrails || `https://www.openstreetmap.org/relation/${p.osm_relation}`,
      },
      name: p.name, area: nearestLocality(pts[0][0], pts[0][1]),
      lat: pts[0][0], lng: pts[0][1],
      path: pts.map(([la, ln]) => [Math.round(la * 1e5) / 1e5, Math.round(ln * 1e5) / 1e5]),
      distance: totalKm,
      elevation: gain,
      hours: gain !== null ? naismithHours(totalKm, gain) : null,
      terrainType: terrain.text,
      terrainRank: rating.terrainRank,
      elevationProfile,
      surfaceHazards: [],
      safetyLevel: rating.safetyLevel,
      waterSources,
      rifugi,
      startPoint: { lat: pts[0][0], lng: pts[0][1], label: startLabel },
      desc: `${articleFor(totalKm)} ${totalKm} km ${isLoop ? 'loop' : 'route'} near ${nearestLocality(pts[0][0], pts[0][1])}, imported from the OpenStreetMap hiking network${p.ref ? ` (trail ${p.ref})` : ''}. Passed automated dog-suitability screening: no via ferrata, ladders, or alpine-grade (T3+) sections on record.${directionNote ? ' ' + directionNote : ''}`,
      tips: 'Imported route, elevation, distance, mapped fountains and rifugi come from OpenStreetMap data. This trail has not been field reviewed by ORMA; exposure, shade, livestock and current conditions remain unknown. Check conditions locally.',
      ...(segments > 1 ? { osmGeometryGaps: segments - 1 } : {})
    };
    if (p.leash) entry.leash = p.leash;
    if (p.dogFriendlyNotes) entry.dogNotes = p.dogFriendlyNotes;
    entries.push(entry);
  }

  const banner = '// AUTO-GENERATED by scripts/promote-osm-trails.js, do not edit by hand.\n'
    + '// Curated trails live in trails-data.js; this file appends OSM-imported trails.\n'
    + '// Data: © OpenStreetMap contributors (ODbL); elevation: Open-Meteo (non-commercial).\n';
  const js = `${banner}(function () {\n`
    + `  const imported = ${JSON.stringify(entries)};\n`
    + `  if (typeof trails !== 'undefined' && Array.isArray(trails)) {\n`
    + `    // Never append an imported twin of a trail that already exists (i.e. one\n`
    + `    // that has been hand-verified into trails-data.js). Makes duplication\n`
    + `    // impossible even if this file is stale relative to the curated data.\n`
    + `    const existing = new Set(trails.map((t) => t.id));\n`
    + `    trails.push(...imported.filter((t) => !existing.has(t.id)));\n`
    + `  }\n`
    + `})();\n`;
  await fs.writeFile(OUTPUT_PATH, js);
  // Only the points this run used, so the file stays the live set.
  if(elevationUsed.size){
    await bank({ prune: true });
    const fetched = elevationUsed.size - [...elevationUsed.keys()].filter(k => elevationCache.has(k)).length;
    console.log(`[elev] ${elevationUsed.size} point(s) on file (${fetched} newly fetched) -> ${ELEVATION_CACHE_PATH}`);
  }
  console.log(`[done] Wrote ${entries.length} promoted trails -> ${OUTPUT_PATH}`);
}

// Guarded so the geometry assembly above can be tested without fetching or
// writing anything. Running the script directly is unchanged.
if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { articleFor, chainLines, toPath, widestGapMeters, haversineMeters,
  lineMeters, recomputeCumKm, reverseConnectors,
  DROPPABLE_PIECE_M, DROPPABLE_SHARE_OF_WALK, LOOP_CLOSE_M,
  elevationKey, loadElevationCache, saveElevationCache, cachePointsToSave, fetchElevations };
