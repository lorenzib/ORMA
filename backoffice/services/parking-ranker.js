'use strict';

const { distanceMeters } = require('./geometry-validator');

function nearestRoutePoint(coordinates, position){
  let best = null;
  coordinates.forEach((point, index) => {
    const distanceM = distanceMeters(point, position);
    if(!best || distanceM < best.distanceM){
      best = { index, position: point, distanceM };
    }
  });
  return best;
}

function normalizeParking(feature, index){
  const properties = feature && feature.properties || {};
  const position = feature && feature.geometry && feature.geometry.coordinates;
  if(properties.kind !== 'parking' || !Array.isArray(position) || position.length !== 2 ||
     !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return null;
  return {
    datasetIndex: index,
    externalId: properties.osmId || null,
    name: properties.name || null,
    position,
    fee: properties.fee || 'unknown',
    access: properties.access || 'unknown',
    parkingType: properties.parking || 'unknown',
  };
}

function confidenceFor(parking, distanceM){
  let confidence = distanceM <= 100 ? 0.72 : distanceM <= 250 ? 0.62 : 0.52;
  if(parking.name) confidence += 0.08;
  if(parking.externalId) confidence += 0.08;
  return Math.round(Math.min(confidence, 0.9) * 100) / 100;
}

function rankParking(coordinates, featureCollection, options = {}){
  const radiusM = options.radiusM || 500;
  const limit = options.limit || 3;
  if(!Array.isArray(coordinates) || coordinates.length < 2) return [];
  const features = Array.isArray(featureCollection && featureCollection.features)
    ? featureCollection.features : [];

  return features.map(normalizeParking).filter(Boolean).map(parking => {
    const route = nearestRoutePoint(coordinates, parking.position);
    return {
      ...parking,
      distanceToRouteM: Math.round(route.distanceM),
      routeAnchor: { index: route.index, position: route.position },
      rankScore: Math.round(route.distanceM + (parking.name ? 0 : 75) + (parking.access === 'private' ? 1000 : 0)),
    };
  }).filter(parking => parking.distanceToRouteM <= radiusM && parking.access !== 'private')
    .sort((a, b) => a.rankScore - b.rankScore ||
      String(a.name || '').localeCompare(String(b.name || '')) ||
      a.position[0] - b.position[0] || a.position[1] - b.position[1])
    .slice(0, limit)
    .map((parking, index) => ({
      rank: index + 1,
      status: 'mapped-suggestion',
      name: parking.name || 'Unnamed mapped parking area',
      position: parking.position,
      osmId: parking.externalId,
      distanceToRouteM: parking.distanceToRouteM,
      routeAnchor: parking.routeAnchor,
      attributes: {
        fee: parking.fee,
        access: parking.access,
        parkingType: parking.parkingType,
      },
      confidence: confidenceFor(parking, parking.distanceToRouteM),
      source: {
        provider: 'OpenStreetMap access-point snapshot',
        generatedAt: featureCollection.generatedAt || null,
        attribution: featureCollection.attribution || '© OpenStreetMap contributors',
      },
    }));
}

module.exports = { rankParking, nearestRoutePoint, normalizeParking, confidenceFor };
