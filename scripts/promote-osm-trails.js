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
 * Output: osm-trails-data.js — loaded AFTER trails-data.js, it appends to the
 * trails array. trails-data.js stays the hand-curated single source of truth
 * and is never touched by this script.
 *
 * NOTE: Open-Meteo is used under its free non-commercial tier (same caveat as
 * the live weather integration).
 */

const fs = require('fs/promises');
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

const WATER_MATCH_METERS = 150;
const HUT_MATCH_METERS = 250;
const ACCESS_MATCH_METERS = 400;      // access point must be this close to the route
const ELEVATION_BATCH = 100;          // Open-Meteo max per request
const ELEVATION_SAMPLES = 80;         // sampled points per route
const ACCESS_PATH = path.join(ROOT, REGION.accessFile);

// Real, well-known Dolomites localities used only to give each imported
// trail a meaningful "area" label (nearest locality to the route start).
const LOCALITIES = [
  ['Cortina d\'Ampezzo', 46.5405, 12.1357], ['Ortisei / Val Gardena', 46.5747, 11.6717],
  ['Selva di Val Gardena', 46.5551, 11.7605], ['Canazei / Val di Fassa', 46.4770, 11.7714],
  ['Corvara / Alta Badia', 46.5504, 11.8746], ['San Cassiano / Alta Badia', 46.5687, 11.9312],
  ['Dobbiaco / Toblach', 46.7357, 12.2210], ['San Candido / Innichen', 46.7327, 12.2800],
  ['Sesto / Sexten', 46.7025, 12.3500], ['Braies / Prags', 46.7207, 12.1350],
  ['Alpe di Siusi / Seiser Alm', 46.5402, 11.6181], ['Castelrotto / Kastelruth', 46.5670, 11.5599],
  ['San Martino di Castrozza', 46.2612, 11.8022], ['Madonna di Campiglio', 46.2295, 10.8269],
  ['Falcade / Val Biois', 46.3576, 11.8712], ['Arabba', 46.4977, 11.8747],
  ['Alleghe', 46.4066, 12.0209], ['Auronzo di Cadore', 46.5527, 12.4419],
  ['Val di Funes / Villnöss', 46.6440, 11.6810], ['Nova Levante / Carezza', 46.4300, 11.5380],
  ['Predazzo / Val di Fiemme', 46.3110, 11.6010], ['Bolzano / Bozen', 46.4983, 11.3548],
  ['Bressanone / Brixen', 46.7151, 11.6570], ['Vipiteno / Sterzing', 46.8977, 11.4331],
  ['Brunico / Bruneck', 46.7966, 11.9376], ['Belluno', 46.1420, 12.2167],
  ['Agordo', 46.2820, 12.0330], ['Pieve di Cadore', 46.4276, 12.3730],
  ['Fiera di Primiero', 46.1770, 11.8290], ['Cavalese', 46.2910, 11.4600],
  // Savoy / Haute-Savoie
  ['Chamonix-Mont-Blanc', 45.9237, 6.8694], ['Les Houches', 45.8906, 6.7986],
  ['Saint-Gervais-les-Bains', 45.8926, 6.7130], ['Megève', 45.8567, 6.6176],
  ['Annecy', 45.8992, 6.1294], ['Talloires / Lac d\'Annecy', 45.8410, 6.2140],
  ['La Clusaz', 45.9045, 6.4237], ['Le Grand-Bornand', 45.9410, 6.4280],
  ['Morzine', 46.1791, 6.7090], ['Avoriaz', 46.1912, 6.7742],
  ['Samoëns', 46.0826, 6.7266], ['Thonon-les-Bains', 46.3705, 6.4784],
  ['Évian-les-Bains', 46.4009, 6.5877], ['Chambéry', 45.5646, 5.9178],
  ['Aix-les-Bains', 45.6886, 5.9151], ['Albertville', 45.6754, 6.3925],
  ['Beaufort / Beaufortain', 45.7192, 6.5735], ['Bourg-Saint-Maurice', 45.6180, 6.7690],
  ['Val d\'Isère', 45.4489, 6.9797], ['Tignes', 45.4685, 6.9060],
  ['Courchevel', 45.4154, 6.6340], ['Méribel', 45.3966, 6.5654],
  ['Pralognan-la-Vanoise', 45.3810, 6.7220], ['Modane / Maurienne', 45.2016, 6.6580],
  ['Valloire', 45.1650, 6.4300], ['Saint-Jean-de-Maurienne', 45.2760, 6.3460]
];

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Flatten a (Multi)LineString into one [lat, lng] path, plus cumulative km.
function toPath(geometry) {
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  const pts = [];
  for (const line of lines) for (const [lng, lat] of line) pts.push([lat, lng]);
  const cumKm = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cumKm.push(cumKm[i - 1] + haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) / 1000);
  }
  return { pts, cumKm, segments: lines.length };
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

async function fetchElevations(samples) {
  const elevations = [];
  for (let i = 0; i < samples.length; i += ELEVATION_BATCH) {
    const batch = samples.slice(i, i + ELEVATION_BATCH);
    const url = 'https://api.open-meteo.com/v1/elevation'
      + `?latitude=${batch.map((p) => p.lat.toFixed(5)).join(',')}`
      + `&longitude=${batch.map((p) => p.lng.toFixed(5)).join(',')}`;
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt += 1) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': 'ORMA-trail-builder/1.0 (+https://www.app-orma.com)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        elevations.push(...data.elevation);
        ok = true;
      } catch (err) {
        console.warn(`[elev] attempt ${attempt} failed: ${err.message}`);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
    if (!ok) return null; // give up on this route's elevation, keep the trail
    await new Promise((r) => setTimeout(r, 250));
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
  // ≥18%) rated two-thirds of the catalog Caution — one short ramp tarred
  // whole family loops. A safety rating should describe what the trail
  // sustains, so:
  //   1. median-3 smoothing (elevation-API spikes: real trails don't drop
  //      97 m and climb back in 300 m),
  //   2. grade measured over 0.25–0.8 km windows only,
  //   3. windows must exceed a 30 m noise floor AND be credible — no
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
  let best = null;
  let bestD = Infinity;
  for (const [name, la, ln] of LOCALITIES) {
    const d = haversineMeters(lat, lng, la, ln);
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
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

function recomputeCumKm(pts) {
  const cumKm = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cumKm.push(cumKm[i - 1] + haversineMeters(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) / 1000);
  }
  return cumKm;
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
    // Unknown values are mapper free-text ("una", typos, local slang) —
    // bucket them honestly instead of parroting garbage into the UI.
    const label = SURFACE_LABELS[key] || 'other surfaces';
    grouped[label] = (grouped[label] || 0) + km;
    taggedKm += km;
  }
  // Surface tags with ~zero measured length would divide by zero ("NaN%") —
  // treat them the same as having no usable surface data at all.
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
// reversed? Returns { reverse: bool, note: string } — computed, not opinion.
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
  return { reverse: false, note: null }; // symmetric — no recommendation
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
    console.warn('[promote] No access-points.geojson — start points fall back to route geometry.');
  }

  const waterIndex = buildIndex(water.features);
  const hutIndex = buildIndex(huts.features.filter((f) =>
    (f.properties || {}).name && /alpine_hut|wilderness_hut|restaurant|cafe|bar/.test(
      `${f.properties.tourism || ''}|${f.properties.amenity || ''}`)));

  console.log(`[promote] ${routes.features.length} routes to promote.`);
  const entries = [];

  // Relations excluded from import. Two reasons, marked per entry:
  // - verified: hand-verified and moved into trails-data.js (skip = no duplicate)
  // - BANNED: dogs are not allowed on the ground (protected areas etc.) —
  //   these must never appear on a dog-trail site, imported or otherwise.
  const PROMOTED_RELATIONS = new Set([
    3982382, // Circuit Béatrice de Savoie — verified 2026-07-14
    6250300, // Boucle du Lac Vert (Passy) — verified 2026-07-14
    9933643, // Le Lac Vert (La Plagne) — verified 2026-07-14
    10116283, // Itinéraire de découverte historique (Plateau des Glières) — verified 2026-07-14
    10116380, // Itinéraire découverte de la nature (Plateau des Glières) — verified 2026-07-14
    20347406, // Sentier des Patriotes (Plateau des Glières) — verified 2026-07-14
    11517208, // La Croix des Salles (Megève/Combloux) — verified 2026-07-14
    14987412, // Sentier du Four (Arbusigny) — enriched import in trails-data.js, still curated:false
    18055492, // Le Mont d'Arbois - Mont Joux (Megève) — verified 2026-07-14
    14864704, // Boucle du Taillefer (Duingt) — verified 2026-07-14
    20302682, // BANNED: Sentier découverte de Bellevaux (Bauges) — inside RNCFS des Bauges, dogs prohibited even on leash (removed 2026-07-14)
    14095296, // Les Marais d'Albens (Entrelacs) — verified 2026-07-14
    16322228, // Boucle du Marais des Chassettes (Challes-les-Eaux) — verified 2026-07-14
    16363583, // Le Marais de Pré Lombard (La Motte-Servolex) — verified 2026-07-14, loop rebuilt
    16395076, // Boucle du Lac de la Thuile — verified 2026-07-14
    19153189, // Le Belvédère (Saint-Pierre-d'Albigny) — verified 2026-07-14
    15591346, // Sentier des Buis (Montmélian) — verified 2026-07-14
    16365005, // La Galoppaz par la Combe Servenne — enriched import, curated:false, loop rebuilt
    16395059, // REMOVED: Colombier par la Fullie et la Cochette — fiches strongly advise against dogs even leashed (patous, exposed ridge); removed 2026-07-14
  ]);

  for (const [n, feature] of routes.features.entries()) {
    const p = feature.properties;
    if (PROMOTED_RELATIONS.has(Number(p.osm_relation))) {
      console.log(`[promote] Skipping ${p.name} (${p.osm_relation}) — already verified in trails-data.js.`);
      continue;
    }
    const isLoop = p.loop === true || p.loop === 'true';
    let { pts, segments } = toPath(feature.geometry);
    let cumKm = recomputeCumKm(pts);

    // --- Verified start point: anchor to the nearest real access point ---
    let startLabel = 'Route start per OpenStreetMap — best parking/access not yet verified';
    if (accessIndex && segments === 1) {
      const best = findBestAccess(pts, accessIndex);
      if (best) {
        if (isLoop) {
          pts = rotateLoop(pts, best.vertexIndex);         // loop now begins at the access point
        } else if (best.vertexIndex > pts.length / 2) {
          pts = pts.slice().reverse();                     // start the line from the accessible end
        }
        cumKm = recomputeCumKm(pts);
        startLabel = accessLabel(best, isLoop);
      }
    }

    const totalKm = Math.round(cumKm[cumKm.length - 1] * 10) / 10;
    const samples = sampleAlong(pts, cumKm, ELEVATION_SAMPLES);

    console.log(`[promote] ${n + 1}/${routes.features.length} ${p.name} (${totalKm} km)…`);
    const elevations = await fetchElevations(samples);

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
          cumKm = recomputeCumKm(pts);
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
      desc: `${isLoop ? 'A' : 'An'} ${totalKm} km ${isLoop ? 'loop' : 'route'} near ${nearestLocality(pts[0][0], pts[0][1])}, imported from the OpenStreetMap hiking network${p.ref ? ` (trail ${p.ref})` : ''}. Passed automated dog-suitability screening: no via ferrata, ladders, or alpine-grade (T3+) sections on record.${directionNote ? ' ' + directionNote : ''}`,
      tips: 'Imported route — elevation, distance, mapped fountains and rifugi come from OpenStreetMap data. This trail has not been field reviewed by ORMA; exposure, shade, livestock and current conditions remain unknown. Check conditions locally.',
      ...(segments > 1 ? { osmGeometryGaps: segments - 1 } : {})
    };
    if (p.leash) entry.leash = p.leash;
    if (p.dogFriendlyNotes) entry.dogNotes = p.dogFriendlyNotes;
    entries.push(entry);
  }

  const banner = '// AUTO-GENERATED by scripts/promote-osm-trails.js — do not edit by hand.\n'
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
  console.log(`[done] Wrote ${entries.length} promoted trails -> ${OUTPUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
