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
  components.sort((a, b) => b.coordinates.length - a.coordinates.length);
  return components;
}

function reconstructRelation(payload, externalId, options = {}){
  const relationId = Number(String(externalId).replace('relation/', ''));
  const extracted = memberWays(payload, relationId);
  const components = stitchWays(extracted.ways, options);
  const primary = components[0] || { coordinates: [], wayIds: [] };
  const assessment = assessGeometry(primary.coordinates, { closureThresholdM: options.closureThresholdM || 100 });
  const issues = [...assessment.issues];
  const tags = extracted.relation.tags || {};
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
    components: components.map(component => ({ wayIds: component.wayIds, pointCount: component.coordinates.length })),
    missingWayIds: extracted.missingWayIds,
    assessment: { ...assessment, issues, status: issues.length ? 'needs-review' : 'passed' },
  };
}

module.exports = { samePoint, cleanLine, memberWays, stitchWays, reconstructRelation };
