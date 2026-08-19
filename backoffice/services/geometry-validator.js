'use strict';

const EARTH_RADIUS_M = 6371008.8;

function toRadians(value){
  return value * Math.PI / 180;
}

function distanceMeters(a, b){
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(b[0] - a[0]);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function assessGeometry(coordinates, options = {}){
  const closureThresholdM = options.closureThresholdM || 100;
  const issues = [];
  if(!Array.isArray(coordinates) || coordinates.length < 2){
    return {
      version: 'geometry-v1', status: 'rejected', isClosed: false,
      closureDistanceM: null, distanceKm: null, maxSegmentM: null,
      issues: ['missing-geometry'],
    };
  }

  const valid = coordinates.every(point => Array.isArray(point) && point.length === 2 &&
    Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
    point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90);
  if(!valid){
    return {
      version: 'geometry-v1', status: 'rejected', isClosed: false,
      closureDistanceM: null, distanceKm: null, maxSegmentM: null,
      issues: ['invalid-coordinate'],
    };
  }

  const segments = coordinates.slice(1).map((point, index) => distanceMeters(coordinates[index], point));
  const totalM = segments.reduce((sum, segment) => sum + segment, 0);
  const maxSegmentM = Math.max(...segments);
  const closureDistanceM = distanceMeters(coordinates[0], coordinates[coordinates.length - 1]);
  const isClosed = closureDistanceM <= closureThresholdM;
  if(!isClosed) issues.push('not-closed-loop');
  if(totalM < 250) issues.push('implausibly-short');
  if(maxSegmentM > Math.max(5000, totalM * 0.45)) issues.push('suspicious-coordinate-jump');

  return {
    version: 'geometry-v1',
    status: issues.length ? 'rejected' : 'passed',
    isClosed,
    closureDistanceM: Math.round(closureDistanceM),
    distanceKm: Math.round(totalM / 10) / 100,
    maxSegmentM: Math.round(maxSegmentM),
    pointCount: coordinates.length,
    issues,
  };
}

module.exports = { assessGeometry, distanceMeters };
