'use strict';

const DEFAULT_ENDPOINTS = Object.freeze([
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
]);
const USER_AGENT = 'ORMA-Backoffice/0.1 (+https://www.dolopaws.com/contact.html)';

function numericRelationId(externalId){
  const match = String(externalId || '').match(/^(?:relation\/)?(\d+)$/);
  if(!match) throw new Error('A numeric OSM relation ID is required');
  return Number(match[1]);
}

function buildRelationQuery(externalId){
  const id = numericRelationId(externalId);
  return [
    '[out:json][timeout:120];',
    `relation(${id})->.route;`,
    '.route out body;',
    'way(r.route);',
    'out body geom;',
  ].join('\n');
}

// Route relations running near a drawn path, with the geometry of their member
// ways, so a composite can be measured without a fetch per candidate. The path
// is sampled because Overpass takes the corridor as a polyline and a long trail
// carries more points than the query needs.
const ROUTE_SAMPLE_POINTS = 60;

function samplePath(path, maximum = ROUTE_SAMPLE_POINTS){
  const points = Array.isArray(path) ? path.filter(point => Array.isArray(point) && point.length >= 2) : [];
  if(points.length <= maximum) return points;
  const sampled = [];
  for(let index = 0; index < maximum; index += 1){
    sampled.push(points[Math.round(index * (points.length - 1) / (maximum - 1))]);
  }
  return sampled;
}

const AERIALWAY_RADIUS_M = 80;

/**
 * The route relations running near a drawn path, and -- for an itinerary that
 * rides a lift -- the aerialways too, in one request.
 *
 * They were two. Overpass is why this work lives in Actions at all: the public
 * mirrors throttle and time out, and a second round trip is a second chance to
 * get nothing. A dispatched discover run failed on each query in turn on
 * consecutive attempts, having fetched the other one fine.
 *
 * Only an itinerary that rides a lift asks for them, so no other trail pays for
 * a clause it has no use for.
 */
function buildRoutesNearPathQuery(path, radiusMetres = 60, options = {}){
  const corridor = samplePath(path).map(point => `${point[0]},${point[1]}`).join(',');
  if(!corridor) throw new Error('A drawn path is required to look for route relations');
  return [
    '[out:json][timeout:180];',
    `rel(around:${radiusMetres},${corridor})["type"="route"]["route"~"hiking|foot"]->.routes;`,
    '.routes out body;',
    'way(r.routes);',
    'out geom;',
    ...(options.includeAerialways ? [
      `way(around:${options.aerialwayRadiusMetres || AERIALWAY_RADIUS_M},${corridor})["aerialway"];`,
      'out tags geom;',
    ] : []),
  ].join('\n');
}

// No hiking relation covers a chairlift: OSM maps it as an aerialway, not a
// path. Reading them out of the corridor payload keeps that one request.
function aerialwaysFromPayload(payload){
  return ((payload && payload.elements) || [])
    .filter(element => element.type === 'way' && element.tags && element.tags.aerialway
      && Array.isArray(element.geometry))
    .map(element => ({
      id: element.id,
      tags: element.tags,
      points: element.geometry
        .filter(node => Number.isFinite(node.lat) && Number.isFinite(node.lon))
        .map(node => [node.lat, node.lon]),
    }))
    .filter(way => way.points.length > 1);
}

// One query, tried against each mirror in turn. Three callers had their own
// copy of this loop; the third was about to be written.
async function runQuery(query, options, failure){
  const endpoints = options.endpoints || DEFAULT_ENDPOINTS;
  const fetchImpl = options.fetchImpl || fetch;
  let lastError = null;
  for(const endpoint of endpoints){
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 180000);
    try{
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'user-agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if(!response.ok) throw new Error(`Overpass returned HTTP ${response.status}`);
      return { endpoint, query, payload: await response.json() };
    }catch(error){
      lastError = error;
    }finally{
      clearTimeout(timeout);
    }
  }
  throw new Error(`${failure}: ${lastError ? lastError.message : 'no endpoint available'}`);
}

async function fetchRoutesNearPath(path, options = {}){
  return runQuery(buildRoutesNearPathQuery(path, options.radiusMetres, options), options,
    'Unable to look for route relations');
}

// A single relation comes from the OpenStreetMap API first -- it is the source
// of record, and it answers without queuing behind an Overpass mirror -- with
// Overpass as the fallback. Its own timeout, which is shorter than a corridor
// query's for the same reason.
async function fetchRelation(externalId, options = {}){
  const fetchImpl = options.fetchImpl || fetch;
  const relationId = numericRelationId(externalId);
  const mainApiUrl = `https://api.openstreetmap.org/api/0.6/relation/${relationId}/full.json`;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 60000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let mainError = null;
  try{
    const response = await fetchImpl(mainApiUrl, {
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT },
    });
    if(!response.ok) throw new Error(`OpenStreetMap API returned HTTP ${response.status}`);
    return { endpoint: mainApiUrl, query: null, payload: await response.json() };
  }catch(error){
    mainError = error;
  }finally{
    clearTimeout(timeout);
  }
  try{
    return await runQuery(buildRelationQuery(externalId), { ...options, timeoutMs },
      'Unable to fetch OSM relation');
  }catch(error){
    throw new Error(`${error.message} (OpenStreetMap API first: ${mainError.message})`);
  }
}

module.exports = { DEFAULT_ENDPOINTS, USER_AGENT, ROUTE_SAMPLE_POINTS, numericRelationId, buildRelationQuery,
  samplePath, buildRoutesNearPathQuery, fetchRoutesNearPath, fetchRelation,
  AERIALWAY_RADIUS_M, aerialwaysFromPayload };
