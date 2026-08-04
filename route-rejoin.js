(function(root){
  'use strict';

  const VERSION = '1.0.0';
  const EARTH_RADIUS_M = 6371000;
  const DIRECTIONS = Object.freeze(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

  function validPoint(point){
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
      point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
  }

  function toLocal(point, origin){
    const radians = Math.PI / 180;
    return {
      x: (point.lng - origin.lng) * radians * EARTH_RADIUS_M *
        Math.cos(((point.lat + origin.lat) / 2) * radians),
      y: (point.lat - origin.lat) * radians * EARTH_RADIUS_M,
    };
  }

  function nearestPointOnSegment(origin, start, end){
    const a = toLocal(start, origin);
    const b = toLocal(end, origin);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
    const x = a.x + dx * fraction;
    const y = a.y + dy * fraction;
    return {
      point: {
        lat: start.lat + (end.lat - start.lat) * fraction,
        lng: start.lng + (end.lng - start.lng) * fraction,
      },
      fraction,
      distanceM: Math.hypot(x, y),
    };
  }

  function bearingDegrees(from, to){
    if(!validPoint(from) || !validPoint(to)) return NaN;
    const radians = Math.PI / 180;
    const lat1 = from.lat * radians;
    const lat2 = to.lat * radians;
    const deltaLng = (to.lng - from.lng) * radians;
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return (Math.atan2(y, x) / radians + 360) % 360;
  }

  function cardinalDirection(degrees){
    if(!Number.isFinite(degrees)) return null;
    return DIRECTIONS[Math.round(((degrees % 360) + 360) % 360 / 45) % DIRECTIONS.length];
  }

  function guidance(position, route){
    if(!validPoint(position) || !Array.isArray(route) || route.length < 2 ||
       route.some(point => !validPoint(point))) return null;

    let nearest = null;
    for(let index = 0; index < route.length - 1; index++){
      const candidate = nearestPointOnSegment(position, route[index], route[index + 1]);
      if(!nearest || candidate.distanceM < nearest.distanceM){
        nearest = { ...candidate, segmentIndex: index };
      }
    }
    const bearing = bearingDegrees(position, nearest.point);
    return {
      version: VERSION,
      target: nearest.point,
      distanceM: nearest.distanceM,
      bearingDegrees: bearing,
      direction: cardinalDirection(bearing),
      segmentIndex: nearest.segmentIndex,
      segmentFraction: nearest.fraction,
      routingMode: 'orientation-only',
    };
  }

  root.DoloPawsRouteRejoin = Object.freeze({
    VERSION,
    bearingDegrees,
    cardinalDirection,
    guidance,
  });
})(typeof window !== 'undefined' ? window : globalThis);
