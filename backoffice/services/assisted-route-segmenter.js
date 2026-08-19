'use strict';

const { distanceMeters } = require('./geometry-validator');

function parseElevatedTrackpoints(xml){
  if(typeof xml !== 'string' || !xml.trim()) throw new Error('GPX XML is required');
  const points = [...xml.matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)">([\s\S]*?)<\/trkpt>/g)].map(match => {
    const elevation = match[3].match(/<ele>([^<]+)<\/ele>/);
    return { lng: Number(match[2]), lat: Number(match[1]), elevationM: elevation ? Number(elevation[1]) : null };
  });
  if(points.length < 2 || points.some(point => !Number.isFinite(point.lng) || !Number.isFinite(point.lat))){
    throw new Error('GPX must contain valid track points');
  }
  return points;
}

function segmentMetrics(points, startIndex, endIndex = points.length - 1){
  if(!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= endIndex || endIndex >= points.length){
    throw new Error('A valid segment index range is required');
  }
  let distanceM = 0; let rawAscentM = 0; let rawDescentM = 0;
  for(let index = startIndex + 1; index <= endIndex; index += 1){
    const previous = points[index - 1]; const current = points[index];
    distanceM += distanceMeters([previous.lng, previous.lat], [current.lng, current.lat]);
    if(Number.isFinite(previous.elevationM) && Number.isFinite(current.elevationM)){
      const delta = current.elevationM - previous.elevationM;
      if(delta > 0) rawAscentM += delta;
      else rawDescentM -= delta;
    }
  }
  return {
    startIndex, endIndex, pointCount: endIndex - startIndex + 1,
    distanceKm: Number((distanceM / 1000).toFixed(2)),
    rawAscentM: Math.round(rawAscentM), rawDescentM: Math.round(rawDescentM),
    startElevationM: Number.isFinite(points[startIndex].elevationM) ? Math.round(points[startIndex].elevationM) : null,
    endElevationM: Number.isFinite(points[endIndex].elevationM) ? Math.round(points[endIndex].elevationM) : null,
  };
}

function splitAssistedRoute(xml, walkingStartIndex){
  const points = parseElevatedTrackpoints(xml);
  return {
    transport: segmentMetrics(points, 0, walkingStartIndex),
    walking: segmentMetrics(points, walkingStartIndex),
    publicMutationAllowed: false,
  };
}

module.exports = { parseElevatedTrackpoints, segmentMetrics, splitAssistedRoute };
