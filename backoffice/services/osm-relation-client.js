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

async function fetchRelation(externalId, options = {}){
  const endpoints = options.endpoints || DEFAULT_ENDPOINTS;
  const fetchImpl = options.fetchImpl || fetch;
  const query = buildRelationQuery(externalId);
  let lastError = null;
  const relationId = numericRelationId(externalId);
  const mainApiUrl = `https://api.openstreetmap.org/api/0.6/relation/${relationId}/full.json`;
  const mainController = new AbortController();
  const mainTimeout = setTimeout(() => mainController.abort(), options.timeoutMs || 60000);
  try{
    const response = await fetchImpl(mainApiUrl, {
      signal: mainController.signal,
      headers: { 'user-agent': USER_AGENT },
    });
    if(!response.ok) throw new Error(`OpenStreetMap API returned HTTP ${response.status}`);
    return { endpoint: mainApiUrl, query: null, payload: await response.json() };
  }catch(error){
    lastError = error;
  }finally{
    clearTimeout(mainTimeout);
  }
  for(const endpoint of endpoints){
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 60000);
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
      const payload = await response.json();
      return { endpoint, query, payload };
    }catch(error){
      lastError = error;
    }finally{
      clearTimeout(timeout);
    }
  }
  throw new Error(`Unable to fetch OSM relation: ${lastError ? lastError.message : 'no endpoint available'}`);
}

module.exports = { DEFAULT_ENDPOINTS, USER_AGENT, numericRelationId, buildRelationQuery, fetchRelation };
