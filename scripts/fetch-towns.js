#!/usr/bin/env node
'use strict';

/**
 * The towns someone would name when asked where they are going.
 *
 * Country, region and valley is how the catalogue is organised, not how a
 * visitor thinks: someone staying in Bolzano or Chambéry does not know which
 * valley that is, and should not have to. A town resolves to a point, so the
 * ranking works outward from it the same way "Use my location" does.
 *
 * Usage: npm run fetch:towns
 * Output: data/towns.json
 *
 * place=city and place=town only. Villages and hamlets would multiply this
 * several times over with names nobody searches for, and every extra entry is
 * weight in a list that has to stay scannable.
 */

const fs = require('fs');
const path = require('path');

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/**
 * How far a walk can be from the town and still be worth offering. The search
 * sets the same radius on the context it creates, so a town that survives this
 * filter always has something to show.
 */
const REACH_KM = 40;

// The two regions ORMA covers, with enough margin that a town an hour's drive
// outside the trail area still appears -- that is exactly where people stay.
const AREAS = [
  { region:'dolomites', country:'IT', bbox:{ south:45.60, west:10.30, north:47.15, east:12.95 } },
  { region:'savoy', country:'FR', bbox:{ south:44.90, west:5.40, north:46.50, east:7.30 } },
];

/** Bilingual places carry both names; the search should match either. */
function namesFor(tags) {
  const primary = String(tags.name || '').trim();
  const alternates = ['name:it', 'name:de', 'name:fr', 'name:en', 'int_name']
    .map(key => String(tags[key] || '').trim())
    .filter(Boolean);
  // "Klausen - Chiusa" is one place written twice; split it so either half matches.
  const split = primary.includes(' - ') ? primary.split(' - ').map(part => part.trim()) : [];
  return [...new Set([primary, ...split, ...alternates].filter(Boolean))];
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Overpass is free and shared, so 429 and 504 are ordinary weather rather than
 * failures: the first run of this script fetched one region and died on the
 * second. Backing off and retrying is the difference between a tool someone
 * can run and one they have to babysit.
 */
async function queryOverpass(query, attempt = 1) {
  const MAX_ATTEMPTS = 4;
  let response;
  try {
    response = await fetch(OVERPASS, {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'User-Agent':'ORMA/1.0 (towns)' },
      body:new URLSearchParams({ data:query }).toString(),
    });
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) throw error;
    process.stdout.write(`(network, retrying) `);
    await sleep(attempt * 15000);
    return queryOverpass(query, attempt + 1);
  }
  if (response.status === 429 || response.status === 504) {
    if (attempt >= MAX_ATTEMPTS) throw new Error(`Overpass ${response.status} after ${attempt} attempts`);
    process.stdout.write(`(${response.status}, retrying) `);
    await sleep(attempt * 15000);
    return queryOverpass(query, attempt + 1);
  }
  if (!response.ok) throw new Error(`Overpass ${response.status}`);
  return response.json();
}

async function fetchArea(area) {
  const { south, west, north, east } = area.bbox;
  const query = `[out:json][timeout:120];
    node["place"~"^(city|town)$"]["name"](${south},${west},${north},${east});
    out body;`;
  const result = await queryOverpass(query);
  return (result.elements || [])
    .filter(node => node.tags && node.tags.name)
    .map(node => ({
      id:`osm-node-${node.id}`,
      name:String(node.tags.name).trim(),
      names:namesFor(node.tags),
      place:node.tags.place,
      // Rounded: six decimals is a millimetre, and this is a town centre.
      lat:Number(node.lat.toFixed(4)),
      lng:Number(node.lon.toFixed(4)),
      population:Number.parseInt(node.tags.population, 10) || null,
      region:area.region,
      country:area.country,
    }));
}

/** Straight-line kilometres. Good enough to decide "is there anything here". */
function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Every trail ORMA publishes, as plain points. */
function trailPoints() {
  const dir = path.join(__dirname, '..', 'data', 'regions');
  const points = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('-trails.js')) continue;
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const open = source.indexOf('[', source.indexOf('incoming='));
    if (open < 0) continue;
    let depth = 0, end = -1, inString = false, escaped = false;
    for (let index = open; index < source.length; index += 1) {
      const character = source[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') { inString = true; continue; }
      if (character === '[') depth += 1;
      else if (character === ']') { depth -= 1; if (!depth) { end = index + 1; break; } }
    }
    if (end < 0) continue;
    JSON.parse(source.slice(open, end)).forEach(trail => {
      if (Number.isFinite(trail.lat) && Number.isFinite(trail.lng)) points.push([trail.lat, trail.lng]);
    });
  }
  return points;
}

async function main() {
  const towns = [];
  for (const area of AREAS) {
    process.stdout.write(`[towns] ${area.region}… `);
    const found = await fetchArea(area);
    console.log(`${found.length} cities and towns`);
    towns.push(...found);
    // One region at a time, and a pause between: Overpass is a shared service.
    await sleep(2000);
  }

  // A town with no walk within reach is a dead end: the search would accept it
  // and then report that there is nothing here. Better not to offer it.
  const points = trailPoints();
  if (!points.length) throw new Error('No trail coordinates found; refusing to write an unfiltered list');
  const reachable = towns.filter(town =>
    points.some(([lat, lng]) => distanceKm(town.lat, town.lng, lat, lng) <= REACH_KM));
  console.log(`[towns] ${towns.length - reachable.length} dropped with no walk within ${REACH_KM} km`);
  towns.length = 0;
  towns.push(...reachable);

  // A city beats a town of the same name, and the bigger one beats the smaller.
  towns.sort((left, right) =>
    (right.place === 'city') - (left.place === 'city')
    || (right.population || 0) - (left.population || 0)
    || left.name.localeCompare(right.name));

  const output = {
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    source:'OpenStreetMap via Overpass, ODbL',
    reachKm:REACH_KM,
    note:`place=city and place=town with at least one ORMA trail within ${REACH_KM} km. Rebuild with npm run fetch:towns.`,
    towns,
  };
  const file = path.join(__dirname, '..', 'data', 'towns.json');
  fs.writeFileSync(file, `${JSON.stringify(output, null, 1)}\n`);
  console.log(`[towns] ${towns.length} written to data/towns.json`);
}

if (require.main === module) {
  main().catch(error => { console.error(`[towns] ${error.stack || error.message}`); process.exitCode = 1; });
}

module.exports = { AREAS, REACH_KM, namesFor, distanceKm, trailPoints };
