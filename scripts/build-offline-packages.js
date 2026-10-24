#!/usr/bin/env node
'use strict';

/**
 * Build the offline map package for every Verified trail.
 *
 * The offline beta began with two hand-built pilots, Lago di Carezza and Alpe
 * di Siusi. Each took a hand-cut OpenStreetMap extract, a hand-picked map
 * height and a typed revision. This does the same steps for any trail, from
 * the data the site already publishes:
 *
 *   1. the route line, as the trail page draws it;
 *   2. a corridor around it, padded and fitted to the map's aspect, so the
 *      drawing is never stretched;
 *   3. an Overpass extract of that corridor, filtered to what the map draws
 *      and the footpath router walks on;
 *   4. map.svg, footpath-network.json, elevation-profile.json and
 *      safety.json, then the manifest with sizes and SHA-256 hashes.
 *
 * Which trails: those the site shows as Verified (evidence tier route-audited
 * or field-verified), by the same rule the badge uses. A trail that loses its
 * seal loses its package with --prune. The two pilots are never rebuilt here:
 * their revisions are named by the physical device-test gates.
 *
 * Every package is still labelled field-review-required. Verified means the
 * route was audited from authority sources, not that someone walked it with
 * this package on a phone.
 *
 * The raw extracts are not committed. The biggest corridor is 6.7 MB of OSM
 * XML, and 77 of them would add over 100 MB to every clone. They are cached
 * in .cache/offline-map-sources, and the package records the corridor bounds
 * and the retrieval date, so the extract can be fetched again.
 *
 * Usage:
 *   node scripts/build-offline-packages.js               every Verified trail
 *   node scripts/build-offline-packages.js --trail=a,b   only these
 *   node scripts/build-offline-packages.js --refresh     fetch extracts again
 *   node scripts/build-offline-packages.js --prune       drop unverified ones
 *   node scripts/build-offline-packages.js --stale       only missing or out of date
 *   node scripts/build-offline-packages.js --registry    only rewrite the list
 */

const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./load-production-trails');
const evidence = require('../trust/evidence-v1.js');
const offlineElevation = require('../offline-elevation.js');
const { renderOfflineMap } = require('./render-offline-osm-map');
const { buildFootpathNetwork } = require('./build-offline-footpath-network');
const { buildManifest } = require('./build-offline-manifest');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'offline', 'packages');
const CACHE_DIR = path.join(ROOT, '.cache', 'offline-map-sources');
const CONTROLLER = path.join(ROOT, 'offline-packages.js');
const PILOT_IDS = Object.freeze(['alpe-siusi', 'lago-carezza']);
const CORRIDOR_PAD_M = 400;
const MAP_WIDTH = 1200;
const MIN_HEIGHT = 720;
const MAX_HEIGHT = 1600;
const PACKAGE_BUDGET_BYTES = 5242880;
const EXTRACT_STRATEGY = 'overpass-corridor-v2';
const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
    ];
const USER_AGENT = 'ORMA-offline-map-builder/1.0 (https://www.app-orma.com)';

function isVerified(trail){
  return ['route-audited', 'field-verified'].includes(evidence.tierOf(trail));
}

function verifiedTrails(trails){
  return trails.filter(trail => isVerified(trail) && Array.isArray(trail.path) && trail.path.length >= 2);
}

function metresPerDegree(lat){
  return { lat:111320, lng:111320 * Math.cos(lat * Math.PI / 180) };
}

/**
 * The route's box, padded, then widened on its short side until it has the
 * aspect of a map 1200 px wide and 720-1600 px tall. The renderer projects the
 * box straight onto the image, so a box with any other aspect would draw the
 * walk squashed.
 */
function corridorFor(pathPoints, padM = CORRIDOR_PAD_M){
  const lats = pathPoints.map(point => point[0]);
  const lngs = pathPoints.map(point => point[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const scale = metresPerDegree(midLat);
  let south = Math.min(...lats) - padM / scale.lat;
  let north = Math.max(...lats) + padM / scale.lat;
  let west = Math.min(...lngs) - padM / scale.lng;
  let east = Math.max(...lngs) + padM / scale.lng;
  const widthM = (east - west) * scale.lng;
  const heightM = (north - south) * scale.lat;
  const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(MAP_WIDTH * heightM / widthM)));
  const wantedRatio = height / MAP_WIDTH;
  if(heightM / widthM < wantedRatio){
    const grow = (widthM * wantedRatio - heightM) / 2 / scale.lat;
    south -= grow;
    north += grow;
  }else{
    const grow = (heightM / wantedRatio - widthM) / 2 / scale.lng;
    west -= grow;
    east += grow;
  }
  const round = value => Math.round(value * 1e5) / 1e5;
  return { bounds:{ south:round(south), west:round(west), north:round(north), east:round(east) }, height };
}

function overpassQuery(bounds){
  const bbox = [bounds.south, bounds.west, bounds.north, bounds.east].join(',');
  // What render-offline-osm-map.js draws and build-offline-footpath-network.js
  // walks on, and nothing else.
  return `[out:xml][timeout:180][bbox:${bbox}];(` +
    'way[highway];way[waterway];way[natural~"^(water|wood|scrub)$"];way[water];' +
    'way[landuse~"^(forest|meadow|grass)$"];way[amenity=parking];way[building];way[barrier];' +
    'node[amenity~"^(drinking_water|parking|toilets)$"];node[tourism=viewpoint];' +
    // Big lakes and forests are multipolygons: the relation carries the tags,
    // its member ways only the outline pieces.
    'relation[type=multipolygon][natural~"^(water|wood|scrub)$"];relation[type=multipolygon][water];' +
    'relation[type=multipolygon][landuse~"^(forest|meadow|grass)$"];' +
    ');(._;>;);out body;';
}

function withBounds(xml, bounds){
  if(/<bounds\b/.test(xml)) return xml;
  const at = xml.indexOf('>', xml.indexOf('<osm')) + 1;
  if(at < 1) throw new Error('Overpass answered without an <osm> element.');
  const element = `\n  <bounds minlat="${bounds.south}" minlon="${bounds.west}" maxlat="${bounds.north}" maxlon="${bounds.east}"/>`;
  return xml.slice(0, at) + element + xml.slice(at);
}

async function postOverpass(query){
  let lastError = null;
  for(const endpoint of OVERPASS_URLS){
    // A busy server answers 429 or 502; it clears within a minute or two.
    for(let attempt = 0; attempt < 4; attempt += 1){
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 200000);
      try{
        const response = await fetch(endpoint, {
          method:'POST',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'User-Agent':USER_AGENT },
          body:`data=${encodeURIComponent(query)}`,
          signal:controller.signal,
        });
        if(!response.ok) throw new Error(`${endpoint} answered HTTP ${response.status}`);
        const text = await response.text();
        // Overpass reports a timeout or memory limit inside a 200 answer.
        if(/<remark>\s*runtime error/i.test(text)) throw new Error(`${endpoint}: ${text.match(/<remark>([\s\S]*?)<\/remark>/)[1].trim()}`);
        if(!/<osm\b/.test(text)) throw new Error(`${endpoint} answered without OSM XML`);
        return text;
      }catch(error){
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 15000 * 2 ** attempt));
      }finally{
        clearTimeout(timeout);
      }
    }
  }
  throw new Error(`Every Overpass mirror failed (${OVERPASS_URLS.join(', ')}): ${lastError && lastError.message}`);
}

/** The cached extract for this corridor, or a fresh one. */
async function extractFor(trailId, bounds, refresh){
  fs.mkdirSync(CACHE_DIR, { recursive:true });
  const xmlPath = path.join(CACHE_DIR, `${trailId}.osm`);
  const metaPath = path.join(CACHE_DIR, `${trailId}.json`);
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
  const sameCorridor = meta && meta.strategy === EXTRACT_STRATEGY &&
    JSON.stringify(meta.bounds) === JSON.stringify(bounds);
  if(!refresh && sameCorridor && fs.existsSync(xmlPath)){
    return { xml:fs.readFileSync(xmlPath, 'utf8'), retrievedAt:meta.retrievedAt, cached:true };
  }
  const xml = withBounds(await postOverpass(overpassQuery(bounds)), bounds);
  const retrievedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(xmlPath, xml);
  fs.writeFileSync(metaPath, JSON.stringify({ strategy:EXTRACT_STRATEGY, bounds, retrievedAt }, null, 2));
  return { xml, retrievedAt, cached:false };
}

function metresBetween(a, b){
  const scale = metresPerDegree((a[0] + b[0]) / 2);
  return Math.hypot((b[0] - a[0]) * scale.lat, (b[1] - a[1]) * scale.lng);
}

/**
 * Ground height along the route when the trail has no stored profile. Six
 * Verified trails have none; sampled from Open-Meteo once and cached, as the
 * catalogue's own profiles were.
 */
async function sampledProfile(trail){
  const cachePath = path.join(CACHE_DIR, `${trail.id}.elevation.json`);
  const cumulative = [0];
  for(let index = 1; index < trail.path.length; index += 1){
    cumulative.push(cumulative[index - 1] + metresBetween(trail.path[index - 1], trail.path[index]));
  }
  const totalM = cumulative[cumulative.length - 1];
  const count = Math.max(4, Math.min(20, Math.round(totalM / 500) + 1));
  const samples = [];
  for(let step = 0; step < count; step += 1){
    const target = totalM * step / (count - 1);
    const index = Math.max(0, cumulative.findIndex(value => value >= target));
    samples.push({ km:Math.round(target / 100) / 10, point:trail.path[index] });
  }
  let heights = null;
  if(fs.existsSync(cachePath)){
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if(cached.count === count) heights = cached.heights;
  }
  if(!heights){
    const lat = samples.map(sample => sample.point[0].toFixed(5)).join(',');
    const lng = samples.map(sample => sample.point[1].toFixed(5)).join(',');
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, {
      headers:{ 'User-Agent':USER_AGENT },
    });
    if(!response.ok) throw new Error(`Open-Meteo answered HTTP ${response.status} for ${trail.id}`);
    heights = (await response.json()).elevation;
    if(!Array.isArray(heights) || heights.length !== count || heights.some(value => !Number.isFinite(value))){
      throw new Error(`Open-Meteo returned no usable heights for ${trail.id}`);
    }
    fs.mkdirSync(CACHE_DIR, { recursive:true });
    fs.writeFileSync(cachePath, JSON.stringify({ count, heights }));
  }
  return {
    source:'Open-Meteo ground height sampled along the ORMA route',
    points:samples.map((sample, index) => ({ km:sample.km, elev:Math.round(heights[index]) })),
  };
}

function storedProfile(trail){
  return Array.isArray(trail.elevationProfile) && trail.elevationProfile.length >= 2
    ? { source:'ORMA route profile', points:trail.elevationProfile.map(point => ({ km:point.km, elev:point.elev })) }
    : null;
}

async function elevationProfileFor(trail){
  return profileFile(trail, storedProfile(trail) || await sampledProfile(trail));
}

/**
 * The offline page draws the profile only when every point lies further along
 * the route than the one before (offline-elevation.js validProfile), and
 * refuses the whole package otherwise. The catalogue rounds a profile's
 * distances to 0.1 km, so two samples can land on the same mark: Fenn
 * Promenade has two at 1.1 km, and five packages would not open. A point that
 * does not move along the route is dropped; the last point always stays, so
 * the profile still ends where the walk does.
 */
function alongTheRoute(points){
  const kept = [];
  points.forEach((point, index) => {
    const previous = kept[kept.length - 1];
    if(!previous || point.km > previous.km){
      kept.push(point);
    }else if(index === points.length - 1){
      kept[kept.length - 1] = point;
    }
  });
  return kept;
}

function profileFile(trail, stored){
  const points = alongTheRoute(stored.points);
  const profile = {
    schemaVersion:1,
    trailId:trail.id,
    distanceKm:points[points.length - 1].km,
    ascentM:Number.isFinite(trail.elevation) ? trail.elevation : null,
    source:stored.source,
    points,
  };
  if(!offlineElevation.validProfile(profile, trail.id)){
    throw new Error(`${trail.id} has an elevation profile the offline page would reject`);
  }
  return profile;
}

function routeFor(trail){
  const duration = String(trail.hours || '').split(/[–-]/)[0];
  return {
    type:'FeatureCollection',
    features:[{
      type:'Feature',
      id:trail.id,
      properties:{
        name:trail.name,
        distanceKm:trail.distance,
        ascentM:trail.elevation,
        durationHours:Number(duration) || null,
        source:'ORMA repository route geometry',
        verificationStatus:'field-review-required',
      },
      geometry:{
        type:'LineString',
        coordinates:trail.path.map(([lat, lng]) => [lng, lat]),
      },
    }],
  };
}

function durationText(hours){
  const text = String(hours || '').trim();
  if(!text) return null;
  return `${text} ${text === '1' ? 'hour' : 'hours'}`;
}

// The same rule the Browse difficulty filter applies (discovery-filters.js).
function difficultyOf(trail){
  const gain = trail.elevation;
  const rank = trail.terrainRank;
  if(!Number.isFinite(gain) || !Number.isFinite(trail.distance) || !Number.isFinite(rank)) return null;
  if(gain >= 400 || (rank >= 2 && gain >= 250)) return 'Hard';
  if(gain >= 180 || trail.distance >= 6 || rank >= 2) return 'Moderate';
  return 'Easy';
}

function isLoop(pathPoints){
  return pathPoints.length > 2 && metresBetween(pathPoints[0], pathPoints[pathPoints.length - 1]) <= 75;
}

function plainLabel(label){
  // The page's own wording for a mapped water point (trail-trust.js).
  return String(label || '')
    .replace(/\s*\(OSM-verified access point\)/gi, '')
    .replace(/Drinking water\s*\(OSM-verified location\)/i, 'Water point mapped in OpenStreetMap')
    .replace(/OSM-verified/gi, 'mapped in OpenStreetMap')
    .trim();
}

function safetyFor(trail, profile, retrievedAt){
  const start = trail.startPoint && Number.isFinite(trail.startPoint.lat)
    ? trail.startPoint
    : { lat:trail.path[0][0], lng:trail.path[0][1], label:'Start of the route' };
  const water = (Array.isArray(trail.waterSources) ? trail.waterSources : [])
    .filter(source => Number.isFinite(source.lat) && Number.isFinite(source.lng))
    .map(source => ({
      type:'water',
      lat:source.lat,
      lng:source.lng,
      label:plainLabel(source.label) || 'Water point',
      reliability:source.seasonal ? 'Seasonal; not field-verified' : 'Not field-verified',
    }));
  const cautions = [
    'This package has not yet had a dated field review; check signs on the ground.',
  ];
  if(trail.heatRisk === 'high') cautions.push('Heat risk is high on this walk: start early and carry extra water.');
  if(trail.exposure === true) cautions.push('Parts of this walk are exposed; keep your dog close and on a short lead.');
  (Array.isArray(trail.surfaceHazards) ? trail.surfaceHazards : [])
    .filter(text => typeof text === 'string' && text.trim())
    .slice(0, 3)
    .forEach(text => cautions.push(text.trim().replace(/\.?$/, '.')));
  cautions.push(water.length
    ? 'Carry water even though water points are listed.'
    : 'No water point is listed on this walk: carry enough for you and your dog.');
  cautions.push('Local lead rules and temporary closures can change.');
  return {
    schemaVersion:1,
    trailId:trail.id,
    generatedAt:`${retrievedAt}T00:00:00Z`,
    verificationStatus:'field-review-required',
    facts:{
      routeType:isLoop(trail.path) ? 'Loop' : 'One way',
      distanceKm:trail.distance,
      ascentM:trail.elevation,
      highestPointM:Math.max(...profile.points.map(point => point.elev)),
      expectedDuration:durationText(trail.hours),
      difficulty:difficultyOf(trail),
      shadePercent:Number.isFinite(trail.shadeCoverage) ? trail.shadeCoverage : null,
    },
    trailhead:{ lat:start.lat, lng:start.lng, label:plainLabel(start.label) || 'Start of the route' },
    waypoints:water,
    cautions,
    emergency:{
      number:'112',
      note:'Call the European emergency number when urgent help is required. Connectivity is not guaranteed.',
    },
    sources:[
      { name:'ORMA repository route geometry', reviewedAt:trail.verifiedAt || trail.reviewedAt || null },
      {
        name:'OpenStreetMap corridor extract via Overpass',
        url:'https://www.openstreetmap.org/copyright',
        downloadedAt:retrievedAt,
        licence:'ODbL',
      },
    ],
  };
}

function jsonText(value, pretty = true){
  return pretty ? `${JSON.stringify(value, null, 2)}\n` : JSON.stringify(value);
}

function writeJson(file, value, pretty = true){
  fs.writeFileSync(file, jsonText(value, pretty));
}

/**
 * Why a Verified trail's package needs building, or null when it says what the
 * trail record says. Answered without the network: the route, the stored
 * elevation profile and the safety facts are compared byte for byte with what
 * the builder would write, the safety facts at the extract date the package
 * already carries. A trail whose profile was sampled from Open-Meteo keeps the
 * sampled one, which only a rebuild of that trail replaces.
 *
 * The scheduled workflow builds only these, so a run without the extract cache
 * fetches the corridors that need one and leaves every other package's bytes,
 * and so its revision, alone.
 */
function staleReason(trail, packagesDir = PACKAGES_DIR){
  const dir = path.join(packagesDir, trail.id);
  const read = file => fs.existsSync(path.join(dir, file)) ? fs.readFileSync(path.join(dir, file), 'utf8') : null;
  if(read('manifest.json') === null) return 'no package';
  if(read('route.geojson') !== jsonText(routeFor(trail))) return 'route changed';
  const stored = storedProfile(trail);
  const profileText = read('elevation-profile.json');
  if(stored && profileText !== jsonText(profileFile(trail, stored))) return 'elevation profile changed';
  const safetyText = read('safety.json');
  if(profileText === null || safetyText === null) return 'files missing';
  const retrievedAt = String(JSON.parse(safetyText).generatedAt || '').slice(0, 10);
  if(safetyText !== jsonText(safetyFor(trail, JSON.parse(profileText), retrievedAt))) return 'safety facts changed';
  return null;
}

/** The Verified, non-pilot trails whose package is missing or out of date. */
function stalePackages(trails, packagesDir = PACKAGES_DIR){
  return verifiedTrails(trails)
    .filter(trail => !PILOT_IDS.includes(trail.id))
    .map(trail => ({ id:trail.id, reason:staleReason(trail, packagesDir) }))
    .filter(entry => entry.reason);
}

async function buildPackage(trail, options){
  const { bounds, height } = corridorFor(trail.path);
  const extract = await extractFor(trail.id, bounds, options.refresh);
  const dir = path.join(PACKAGES_DIR, trail.id);
  fs.mkdirSync(dir, { recursive:true });
  const route = routeFor(trail);
  const profile = await elevationProfileFor(trail);
  writeJson(path.join(dir, 'route.geojson'), route);
  writeJson(path.join(dir, 'elevation-profile.json'), profile);
  writeJson(path.join(dir, 'safety.json'), safetyFor(trail, profile, extract.retrievedAt));
  const { svg } = renderOfflineMap({
    trailId:trail.id, xml:extract.xml, route, height, scaleMeters:'auto', simplifyPx:1.5, generated:true,
  });
  fs.writeFileSync(path.join(dir, 'map.svg'), svg);
  const graph = buildFootpathNetwork({ trailId:trail.id, xml:extract.xml, route, retrievedAt:extract.retrievedAt });
  writeJson(path.join(dir, 'footpath-network.json'), graph, false);
  const manifest = buildManifest(trail.id, { name:trail.name, height });
  if(manifest.packageBytes > PACKAGE_BUDGET_BYTES){
    throw new Error(`${trail.id} is ${manifest.packageBytes} bytes, over the ${PACKAGE_BUDGET_BYTES}-byte package budget`);
  }
  return { manifest, cached:extract.cached };
}

function packageIds(packagesDir = PACKAGES_DIR){
  if(!fs.existsSync(packagesDir)) return [];
  return fs.readdirSync(packagesDir, { withFileTypes:true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(packagesDir, entry.name, 'manifest.json')))
    .map(entry => entry.name)
    .sort();
}

/** Remove the package of every trail that is no longer Verified; the pilots stay. */
function prunePackages(verifiedIds, packagesDir = PACKAGES_DIR){
  const removed = packageIds(packagesDir).filter(id => !PILOT_IDS.includes(id) && !verifiedIds.has(id));
  removed.forEach(id => fs.rmSync(path.join(packagesDir, id), { recursive:true, force:true }));
  return removed;
}

/** Rewrite the generated list of downloadable trails in offline-packages.js. */
function writeRegistry(){
  const entries = packageIds().map(id => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGES_DIR, id, 'manifest.json'), 'utf8'));
    return `    ${JSON.stringify(id).replace(/"/g, "'")}: ${JSON.stringify(manifest.name)},`;
  });
  const source = fs.readFileSync(CONTROLLER, 'utf8');
  const start = '  // <offline-package-registry>\n';
  const end = '  // </offline-package-registry>\n';
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  if(from < 0 || to < from) throw new Error('offline-packages.js has no <offline-package-registry> block');
  const block = `${start}  const PACKAGE_NAMES = {\n${entries.join('\n')}\n  };\n${end}`;
  fs.writeFileSync(CONTROLLER, source.slice(0, from) + block + source.slice(to + end.length));
  return entries.length;
}

function parseArguments(argv){
  const options = { trailIds:[], refresh:false, prune:false, stale:false, registryOnly:false };
  argv.forEach(argument => {
    if(argument.startsWith('--trail=')) options.trailIds.push(...argument.slice(8).split(',').filter(Boolean));
    else if(argument === '--refresh') options.refresh = true;
    else if(argument === '--prune') options.prune = true;
    else if(argument === '--stale') options.stale = true;
    else if(argument === '--registry') options.registryOnly = true;
    else throw new Error(`Unknown argument: ${argument}`);
  });
  return options;
}

async function main(){
  const options = parseArguments(process.argv.slice(2));
  if(options.registryOnly){
    console.log(`Registered ${writeRegistry()} offline packages.`);
    return;
  }
  const trails = loadProductionTrails(ROOT);
  const verified = verifiedTrails(trails);
  const verifiedIds = new Set(verified.map(trail => trail.id));

  if(options.prune){
    for(const id of prunePackages(verifiedIds)){
      console.log(`[prune] ${id} is no longer Verified; its package was removed.`);
    }
  }

  let targets = verified.filter(trail => !PILOT_IDS.includes(trail.id));
  if(options.trailIds.length){
    const unknown = options.trailIds.filter(id => !verifiedIds.has(id) || PILOT_IDS.includes(id));
    if(unknown.length) throw new Error(`Not a Verified, non-pilot trail: ${unknown.join(', ')}`);
    targets = targets.filter(trail => options.trailIds.includes(trail.id));
  }
  if(options.stale){
    const stale = new Map(stalePackages(trails).map(entry => [entry.id, entry.reason]));
    targets = targets.filter(trail => stale.has(trail.id));
    targets.forEach(trail => console.log(`[stale] ${trail.id}: ${stale.get(trail.id)}`));
  }

  const failures = [];
  for(const [index, trail] of targets.entries()){
    try{
      const { manifest, cached } = await buildPackage(trail, options);
      console.log(`[${index + 1}/${targets.length}] ${trail.id} ${manifest.version} ${Math.ceil(manifest.packageBytes / 1024)} KB${cached ? '' : ' (fetched)'}`);
      if(!cached) await new Promise(resolve => setTimeout(resolve, 2000));
    }catch(error){
      failures.push({ id:trail.id, message:error.message });
      console.error(`[${index + 1}/${targets.length}] ${trail.id} FAILED: ${error.message}`);
    }
  }
  console.log(`Registered ${writeRegistry()} offline packages.`);
  if(failures.length){
    console.error(`${failures.length} package(s) were not built: ${failures.map(item => item.id).join(', ')}`);
    process.exitCode = 1;
  }
}

module.exports = {
  corridorFor, difficultyOf, isVerified, verifiedTrails, safetyFor, staleReason, stalePackages,
  prunePackages, parseArguments, PILOT_IDS,
};

if(require.main === module){
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
