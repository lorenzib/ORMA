#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');

const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ];
const OUTPUT_PATH = path.resolve(__dirname, '..', 'data', 'dolomites-trails.json');
const TARGET_REGIONS = ['Lombardy', 'Veneto', 'Friuli Venezia Giulia', 'Trentino-Alto Adige/Südtirol'];
const REGION_CODES = ['IT-25', 'IT-32', 'IT-34', 'IT-36'];
const MAX_GEOMETRY_POINTS = 80;

function buildOverpassQuery() {
  return [
    '[out:json][timeout:120];',
    'area["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^(IT-25|IT-32|IT-34|IT-36)$"]->.targetRegions;',
    '(',
    '  relation(area.targetRegions)["type"="route"]["route"~"^(hiking|foot)$"];',
    '  way(area.targetRegions)["route"~"^(hiking|foot)$"];',
    '  way(area.targetRegions)["highway"~"^(path|footway|track)$"]["sac_scale"];',
    ');',
    'out body geom center tags;'
  ].join('\n');
}

async function fetchWithRetries(url, body, options = {}) {
  const attempts = options.attempts || 3;
  const timeoutMs = options.timeoutMs || 60000;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      console.log(`[fetch] Attempt ${attempt}/${attempts} -> ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `data=${encodeURIComponent(body)}`,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Overpass returned HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      console.warn(`[fetch] Attempt ${attempt} failed: ${error.message}`);
      if (attempt < attempts) {
        const waitMs = 2000 * Math.pow(2, attempt - 1);
        console.log(`[fetch] Waiting ${waitMs}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Failed to fetch Overpass data after ${attempts} attempts: ${lastError ? lastError.message : 'unknown error'}`);
}

async function fetchFromMirrors(query) {
  let lastError = null;
  for (const url of OVERPASS_URLS) {
    try {
      return await fetchWithRetries(url, query, { attempts: 3, timeoutMs: 90000 });
    } catch (error) {
      lastError = error;
      console.warn(`[fetch] Mirror failed (${url}): ${error.message}`);
    }
  }
  throw lastError || new Error('All Overpass mirrors failed');
}

function roundCoord(value) {
  return Math.round(value * 100000) / 100000;
}

function sampleGeometry(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 2) return [];
  if (geometry.length <= MAX_GEOMETRY_POINTS) {
    return geometry.map((point) => [roundCoord(point.lon), roundCoord(point.lat)]);
  }

  const sampled = [];
  const lastIndex = geometry.length - 1;
  for (let i = 0; i < MAX_GEOMETRY_POINTS; i += 1) {
    const sourceIndex = Math.round((i * lastIndex) / (MAX_GEOMETRY_POINTS - 1));
    const point = geometry[sourceIndex];
    sampled.push([roundCoord(point.lon), roundCoord(point.lat)]);
  }
  return sampled;
}

function getCenter(element) {
  if (element && element.center && typeof element.center.lat === 'number' && typeof element.center.lon === 'number') {
    return [roundCoord(element.center.lon), roundCoord(element.center.lat)];
  }
  if (Array.isArray(element.geometry) && element.geometry.length > 0) {
    const total = element.geometry.reduce(
      (acc, point) => {
        acc.lat += point.lat;
        acc.lon += point.lon;
        return acc;
      },
      { lat: 0, lon: 0 }
    );
    const count = element.geometry.length;
    return [roundCoord(total.lon / count), roundCoord(total.lat / count)];
  }
  return null;
}

function pickSourceTags(tags) {
  const keys = ['route', 'network', 'operator', 'osmc:symbol', 'sac_scale', 'highway', 'surface', 'dog', 'access'];
  const selected = {};
  keys.forEach((key) => {
    if (tags[key]) selected[key] = tags[key];
  });
  return selected;
}

function normalizeElements(elements) {
  const normalized = (Array.isArray(elements) ? elements : [])
    .filter((el) => el && (el.type === 'way' || el.type === 'relation') && typeof el.id === 'number')
    .map((el) => {
      const tags = el.tags || {};
      return {
        id: `${el.type}/${el.id}`,
        osmType: el.type,
        osmId: el.id,
        name: tags.name || null,
        ref: tags.ref || null,
        difficulty: tags.sac_scale || null,
        center: getCenter(el),
        geometry: sampleGeometry(el.geometry),
        sourceTags: pickSourceTags(tags)
      };
    })
    .filter((trail) => trail.center)
    .sort((a, b) => {
      if (a.osmType === b.osmType) return a.osmId - b.osmId;
      return a.osmType.localeCompare(b.osmType);
    });

  return normalized;
}

async function writeOutputFile(payload) {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  const content = JSON.stringify(payload, null, 2) + '\n';
  await fs.writeFile(OUTPUT_PATH, content, 'utf8');
  console.log(`[write] ${OUTPUT_PATH} (${payload.trails.length} trails)`);
}

async function main() {
  console.log('[start] Fetching Dolomites-focused trails from Overpass...');
  const query = buildOverpassQuery();
  const json = await fetchFromMirrors(query);
  const trails = normalizeElements(json.elements);

  const payload = {
    source: 'OpenStreetMap via Overpass API',
    attribution: '© OpenStreetMap contributors',
    license: 'ODbL-1.0',
    generatedAt: new Date().toISOString(),
    regionCodes: REGION_CODES,
    regions: TARGET_REGIONS,
    trails
  };

  await writeOutputFile(payload);
  console.log('[done] Completed.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[error]', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildOverpassQuery,
  normalizeElements,
  sampleGeometry,
  getCenter
};
