'use strict';

const { assessGeometry, distanceMeters } = require('./geometry-validator');

function parseGpx(xml){
  if(typeof xml !== 'string' || !xml.trim()) throw new Error('GPX XML is required');
  const coordinates = [...xml.matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g)]
    .map(match => [Number(match[2]), Number(match[1])]);
  if(coordinates.length < 2) throw new Error('GPX must contain at least two track points');
  if(coordinates.some(point => point.some(value => !Number.isFinite(value)))){
    throw new Error('GPX contains invalid coordinates');
  }
  const elevations = [...xml.matchAll(/<ele>([^<]+)<\/ele>/g)].map(match => Number(match[1]));
  let rawAscentM = null;
  if(elevations.length === coordinates.length && elevations.every(Number.isFinite)){
    rawAscentM = elevations.slice(1).reduce((sum, elevation, index) => (
      elevation > elevations[index] ? sum + elevation - elevations[index] : sum
    ), 0);
  }
  const assessment = assessGeometry(coordinates);
  return {
    geometry: { type: 'LineString', coordinates },
    assessment,
    closureDistanceM: Math.round(distanceMeters(coordinates[0], coordinates.at(-1))),
    elevation: elevations.length ? {
      pointCount: elevations.length,
      minimumM: Math.round(Math.min(...elevations)),
      maximumM: Math.round(Math.max(...elevations)),
      rawAscentM: rawAscentM === null ? null : Math.round(rawAscentM),
    } : null,
  };
}

function proposalFeature(xml, properties){
  const parsed = parseGpx(xml);
  return {
    type: 'Feature',
    properties: {
      ...properties,
      computedDistanceKm: parsed.assessment.distanceKm,
      pointCount: parsed.assessment.pointCount,
      closureDistanceM: parsed.closureDistanceM,
      rawGpxElevation: parsed.elevation,
      geometryAssessment: parsed.assessment,
      humanGate: 'geometry-approval',
      publicMutationAllowed: false,
    },
    geometry: parsed.geometry,
  };
}

module.exports = { parseGpx, proposalFeature };
