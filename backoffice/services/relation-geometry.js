'use strict';

const { distanceMeters, assessGeometry } = require('./geometry-validator');

function samePoint(a, b, toleranceM = 3){
  return distanceMeters(a, b) <= toleranceM;
}

function cleanLine(geometry){
  if(!Array.isArray(geometry)) return [];
  const line = geometry.map(point => [point.lon, point.lat]).filter(point => point.every(Number.isFinite));
  return line.filter((point, index) => index === 0 || !samePoint(point, line[index - 1], 0.05));
}

function memberWays(payload, relationId){
  const elements = Array.isArray(payload && payload.elements) ? payload.elements : [];
  const relation = elements.find(element => element.type === 'relation' && element.id === relationId);
  if(!relation) throw new Error(`OSM relation ${relationId} was not returned`);
  const nodeById = new Map(elements.filter(element => element.type === 'node').map(node => [node.id, node]));
  const wayById = new Map(elements.filter(element => element.type === 'way').map(way => [way.id, way]));
  const missingWayIds = [];
  const ways = (relation.members || []).filter(member => member.type === 'way').map(member => {
    const way = wayById.get(member.ref);
    if(!way){ missingWayIds.push(member.ref); return null; }
    const geometry = Array.isArray(way.geometry) ? way.geometry : (way.nodes || []).map(nodeId => nodeById.get(nodeId)).filter(Boolean);
    const coordinates = cleanLine(geometry);
    if(coordinates.length < 2){ missingWayIds.push(member.ref); return null; }
    return { id: way.id, role: member.role || '', coordinates, tags: way.tags || {} };
  }).filter(Boolean);
  return { relation, ways, missingWayIds };
}

function attach(component, way, toleranceM){
  const first = component.coordinates[0];
  const last = component.coordinates[component.coordinates.length - 1];
  const start = way.coordinates[0];
  const end = way.coordinates[way.coordinates.length - 1];
  if(samePoint(last, start, toleranceM)){
    component.coordinates.push(...way.coordinates.slice(1)); return true;
  }
  if(samePoint(last, end, toleranceM)){
    component.coordinates.push(...way.coordinates.slice(0, -1).reverse()); return true;
  }
  if(samePoint(first, end, toleranceM)){
    component.coordinates.unshift(...way.coordinates.slice(0, -1)); return true;
  }
  if(samePoint(first, start, toleranceM)){
    component.coordinates.unshift(...way.coordinates.slice(1).reverse()); return true;
  }
  return false;
}

// Member ways are stitched end to end at a tight tolerance, which is right: a
// loose one lets a way attach to the wrong neighbour. But attachment is greedy
// and takes the FIRST way within tolerance, so which pieces come out depends on
// the order the relation happens to list its members — raising the attachment
// tolerance is not safe, and measurably is not: one relation that stitched whole
// at 3 m came back in two pieces at 12 m.
//
// So attachment is left exactly as it was, and the pieces it produces are merged
// afterwards at a larger tolerance, closest pair first. Merging can only ever
// reduce the count, so a relation that stitches whole today cannot be broken by
// this, while one torn by a survey-grade gap is put back together. Anello dei
// Colli is two pieces 5 m apart: merged, it measures 5.33 km against an official
// 5.3, and stops failing closure and distance on a fragment of itself.
//
// A wrongly merged line does not pass silently: the distance it produces is
// compared with the official distance, and that check is what catches it.
const MERGE_TOLERANCE_M = 12;

function endpointGap(a, b){
  const ends = piece => [piece.coordinates[0], piece.coordinates[piece.coordinates.length - 1]];
  let best = Infinity;
  for(const p of ends(a)) for(const q of ends(b)) best = Math.min(best, distanceMeters(p, q));
  return best;
}

function mergePieces(pieces, toleranceM){
  const merged = pieces.slice();
  while(merged.length > 1){
    let closest = null;
    for(let i = 0; i < merged.length; i += 1){
      for(let j = i + 1; j < merged.length; j += 1){
        const gap = endpointGap(merged[i], merged[j]);
        if(gap > toleranceM) continue;
        if(!closest || gap < closest.gap) closest = { gap, i, j };
      }
    }
    if(!closest) break;
    const target = merged[closest.i];
    const source = merged[closest.j];
    // Presented as a way so the four join orientations are handled in one place.
    if(!attach(target, { coordinates: source.coordinates }, toleranceM)) break;
    target.wayIds.push(...source.wayIds);
    merged.splice(closest.j, 1);
  }
  return merged;
}

function stitchWays(ways, options = {}){
  const toleranceM = options.toleranceM || 3;
  const unused = ways.map(way => ({ ...way, coordinates: way.coordinates.map(point => point.slice()) }));
  const components = [];
  while(unused.length){
    const seed = unused.shift();
    const component = { wayIds: [seed.id], coordinates: seed.coordinates.slice() };
    let attached = true;
    while(attached){
      attached = false;
      for(let index = 0; index < unused.length; index += 1){
        if(attach(component, unused[index], toleranceM)){
          component.wayIds.push(unused[index].id);
          unused.splice(index, 1);
          attached = true;
          break;
        }
      }
    }
    components.push(component);
  }
  const joined = mergePieces(components, options.mergeToleranceM ?? MERGE_TOLERANCE_M);
  joined.sort((a, b) => b.coordinates.length - a.coordinates.length);
  return joined;
}

// OSM's own answer to "does this route return to its start", where the mapper
// has given one. Anything other than an explicit yes or no is no answer.
function roundtripFromTags(tags){
  const value = String((tags && tags.roundtrip) || '').trim().toLowerCase();
  if(value === 'yes') return true;
  if(value === 'no') return false;
  return null;
}

function reconstructRelation(payload, externalId, options = {}){
  const relationId = Number(String(externalId).replace('relation/', ''));
  const extracted = memberWays(payload, relationId);
  const components = stitchWays(extracted.ways, options);
  const primary = components[0] || { coordinates: [], wayIds: [] };
  const tags = extracted.relation.tags || {};
  const assessment = assessGeometry(primary.coordinates,
    { closureThresholdM: options.closureThresholdM || 100, routeShape: options.routeShape,
      roundtrip: roundtripFromTags(tags) });
  const issues = [...assessment.issues];
  if(tags.type !== 'route' || !['hiking', 'foot'].includes(tags.route)) issues.push('relation-not-hiking-route');
  if(extracted.missingWayIds.length) issues.push('missing-member-geometry');
  if(components.length > 1) issues.push('disconnected-components');
  return {
    relation: {
      id: `relation/${relationId}`,
      version: extracted.relation.version || null,
      timestamp: extracted.relation.timestamp || null,
      tags,
      memberWayCount: extracted.ways.length + extracted.missingWayIds.length,
    },
    geometry: { type: 'LineString', coordinates: primary.coordinates },
    // Every component keeps its line. The route line is the largest one, but a
    // relation that comes back in pieces still holds route geometry in the
    // rest, and a reader measuring coverage needs all of it.
    components: components.map(component => ({ wayIds: component.wayIds,
      pointCount: component.coordinates.length, coordinates: component.coordinates })),
    missingWayIds: extracted.missingWayIds,
    assessment: { ...assessment, issues, status: issues.length ? 'needs-review' : 'passed' },
  };
}

module.exports = { roundtripFromTags, MERGE_TOLERANCE_M, mergePieces,  samePoint, cleanLine, memberWays, stitchWays, reconstructRelation };
