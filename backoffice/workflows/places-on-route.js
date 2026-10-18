'use strict';

/**
 * The places a walk passes, read from the map ORMA already downloaded.
 *
 * `terrainPoi` is asked to establish the water, huts, bars and restaurants on
 * each route, and answers by searching the web. Meanwhile the catalogue carries
 * 12,938 mapped water points and 19,837 huts, bars, cafés and restaurants, sat
 * in data/regions and never consulted.
 *
 * Measured 14 October 2026: 911 searches went on optional detail across the
 * catalogue, and 111 of 225 such claims exhausted their ladder having found
 * nothing. Roughly half the money spent on optional research bought an answer
 * of "unknown" that the mapped data could often have answered outright.
 *
 * What this establishes is mapped presence, and it says so. A mapped fountain
 * is not a promise of running water in October, and a mapped restaurant is not
 * open. That distinction is the one the terrainPoi prompt already draws, and
 * the agent keeps the part that genuinely needs a source: whether the water is
 * drinkable now, whether the hut is open this season.
 */

const { ON_ROUTE_METRES } = require('../services/geometry-validator');

// OSM's own words, kept rather than translated, so a reader of the claim can
// check the tag against the map.
const DRINKABLE = Object.freeze(['drinking_water']);
const FOOD_AND_SHELTER = Object.freeze({
  alpine_hut:'mountain hut', wilderness_hut:'mountain hut', shelter:'shelter',
  restaurant:'restaurant', cafe:'café', bar:'bar', pub:'pub',
  fast_food:'takeaway', biergarten:'beer garden', ice_cream:'ice cream',
});

function metresBetween(a, b){
  const radians = Math.PI / 180;
  const dLat = (b[0] - a[0]) * radians;
  const dLng = (b[1] - a[1]) * radians;
  const chord = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * radians) * Math.cos(b[0] * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(chord));
}

/**
 * Whether this feature is water a walker could drink.
 *
 * `amenity=fountain` is not: OSM uses it for ornamental fountains, and the
 * catalogue holds 1,155 of them. An explicit `drinking_water=no` is believed,
 * because somebody looked and wrote it down -- Sorgente del Brenta is tagged
 * exactly that way.
 */
function isDrinkable(properties = {}){
  if(String(properties.drinking_water || '').toLowerCase() === 'no') return false;
  if(DRINKABLE.includes(properties.amenity)) return true;
  return String(properties.drinking_water || '').toLowerCase() === 'yes';
}

function placeKind(properties = {}){
  return FOOD_AND_SHELTER[properties.amenity] || FOOD_AND_SHELTER[properties.tourism] || null;
}

/** [lat, lng] from a GeoJSON point, which stores [lng, lat]. */
function pointOf(feature){
  const coordinates = feature?.geometry?.coordinates;
  if(!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lng, lat] = coordinates;
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/**
 * How far along the walk each point sits, and how far off it.
 *
 * Measured to the path's vertices rather than to its segments. A walk is drawn
 * densely enough that the difference is below the radius, and measuring to
 * segments would claim a precision the 60 m threshold does not have.
 */
function nearestOnPath(path, point){
  let best = { metres: Infinity, index: -1 };
  for(let index = 0; index < path.length; index += 1){
    const metres = metresBetween(path[index], point);
    if(metres < best.metres) best = { metres, index };
  }
  return best;
}

function cumulativeKm(path){
  const km = [0];
  for(let index = 1; index < path.length; index += 1){
    km.push(km[index - 1] + metresBetween(path[index - 1], path[index]) / 1000);
  }
  return km;
}

/**
 * The mapped places within reach of this walk.
 *
 * `radiusMetres` is the same 60 m the composite measurement uses for whether a
 * route runs along a walk: near enough to be on it rather than merely in the
 * same valley.
 */
function placesOnRoute(path, features, options = {}){
  const line = (Array.isArray(path) ? path : []).filter(point =>
    Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  // `measured` says the line was read, so an empty result is a fact about the
  // walk rather than a fact about this run. Without it, "no water along here"
  // and "we never looked" are the same empty list.
  if(line.length < 2) return { measured: false, water: [], places: [] };
  const radius = Number.isFinite(options.radiusMetres) ? options.radiusMetres : ON_ROUTE_METRES;
  const km = cumulativeKm(line);
  // A box round the walk, widened by the radius, so the catalogue's 32,000
  // points are rejected by two comparisons each instead of a distance to every
  // vertex of the line. Correctness is unchanged: anything inside the radius is
  // inside the box.
  const pad = radius / 111320; // metres to degrees, near enough at this latitude
  const lats = line.map(point => point[0]);
  const lngs = line.map(point => point[1]);
  const box = {
    minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad,
    minLng: Math.min(...lngs) - pad * 1.5, maxLng: Math.max(...lngs) + pad * 1.5,
  };
  const water = [];
  const places = [];
  for(const feature of features || []){
    const point = pointOf(feature);
    if(!point) continue;
    if(point[0] < box.minLat || point[0] > box.maxLat
      || point[1] < box.minLng || point[1] > box.maxLng) continue;
    const near = nearestOnPath(line, point);
    if(near.metres > radius) continue;
    const properties = feature.properties || {};
    const entry = {
      name: String(properties.name || '').trim() || null,
      km: Number(km[near.index].toFixed(2)),
      metresOffRoute: Math.round(near.metres),
      osmId: properties['@id'] || feature.id || null,
      lat: point[0], lng: point[1],
    };
    if(isDrinkable(properties)){
      water.push({ ...entry, tag: properties.amenity || 'drinking_water' });
      continue;
    }
    const kind = placeKind(properties);
    if(kind) places.push({ ...entry, kind, tag: properties.amenity || properties.tourism });
  }
  const byKm = (a, b) => a.km - b.km;
  return { measured: true, water: water.sort(byKm), places: places.sort(byKm) };
}

/**
 * Which claim a mapped place answers.
 *
 * The categories a specialist is asked to research, and the kinds of place on
 * the map that would answer each. A category with nothing of its kind along the
 * walk is one the web is unlikely to answer either.
 */
const CLAIM_PLACE_KINDS = Object.freeze({
  'water': ['__water__'],
  'mountain-huts': ['mountain hut', 'shelter'],
  'food-drink': ['restaurant', 'café', 'bar', 'pub', 'takeaway', 'beer garden', 'ice cream'],
});

/**
 * The categories the map was read for along this walk and found nothing of.
 *
 * Not the same as "we did not look", which is why this takes the measurement
 * rather than deciding from an empty result: a walk with no line, or a run with
 * no mapped features to read, has not been measured and nothing may be
 * concluded from it.
 */
function categoriesTheMapFoundNothingFor(found){
  if(!found || !found.measured) return [];
  const kinds = new Set((found.places || []).map(place => place.kind));
  return Object.entries(CLAIM_PLACE_KINDS)
    .filter(([claimId, wanted]) => claimId === 'water'
      ? !(found.water || []).length
      : !wanted.some(kind => kinds.has(kind)))
    .map(([claimId]) => claimId);
}

module.exports = { ON_ROUTE_METRES, DRINKABLE, FOOD_AND_SHELTER, CLAIM_PLACE_KINDS, metresBetween,
  isDrinkable, placeKind, pointOf, nearestOnPath, cumulativeKm, placesOnRoute,
  categoriesTheMapFoundNothingFor };
