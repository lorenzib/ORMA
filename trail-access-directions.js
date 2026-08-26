(function(root){
  'use strict';

  const DEFAULT_MAX_KM = 100;
  const TRAIL_JOIN_MAX_KM = 5;

  function finiteCoordinate(point){
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
  }

  function distanceKm(first, second){
    if(!finiteCoordinate(first) || !finiteCoordinate(second)) return Infinity;
    const rad = Math.PI / 180;
    const dLat = (second.lat - first.lat) * rad;
    const dLng = (second.lng - first.lng) * rad;
    const lat1 = first.lat * rad;
    const lat2 = second.lat * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function assess(origin, target, maxKm){
    const limitKm = Number.isFinite(maxKm) && maxKm > 0 ? maxKm : DEFAULT_MAX_KM;
    const measuredKm = distanceKm(origin, target);
    return {
      allowed:Number.isFinite(measuredKm) && measuredKm <= limitKm,
      distanceKm:measuredKm,
      maxKm:limitKm,
    };
  }

  function directionsUrl(origin, target, userAgent, travelMode){
    if(!finiteCoordinate(origin) || !finiteCoordinate(target)) return null;
    const apple = /iPhone|iPad|iPod|Macintosh/.test(String(userAgent || ''));
    const walking = travelMode === 'walking';
    return apple
      ? `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${target.lat},${target.lng}${walking ? '&dirflg=w' : ''}`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${target.lat},${target.lng}&travelmode=${walking ? 'walking' : 'driving'}`;
  }

  function normalizeRoutePoint(point){
    if(Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])){
      return { lat:point[0], lng:point[1] };
    }
    return finiteCoordinate(point) ? { lat:point.lat, lng:point.lng } : null;
  }

  // Find the closest point on the route polyline, not merely its closest
  // recorded vertex. The local projection is accurate at the short approach
  // distances this feature permits, while the returned distance is measured
  // with the same haversine calculation used elsewhere on the page.
  function nearestPointOnRoute(origin, route){
    if(!finiteCoordinate(origin) || !Array.isArray(route)) return null;
    const points = route.map(normalizeRoutePoint).filter(Boolean);
    if(!points.length) return null;
    if(points.length === 1){
      return {
        point:points[0],
        distanceKm:distanceKm(origin, points[0]),
        segmentIndex:0,
        fraction:0,
      };
    }

    const kmPerDegree = 111.32;
    const lngScale = kmPerDegree * Math.max(0.01, Math.cos(origin.lat * Math.PI / 180));
    let closest = null;
    points.slice(0, -1).forEach((start, segmentIndex) => {
      const end = points[segmentIndex + 1];
      const startX = (start.lng - origin.lng) * lngScale;
      const startY = (start.lat - origin.lat) * kmPerDegree;
      const endX = (end.lng - origin.lng) * lngScale;
      const endY = (end.lat - origin.lat) * kmPerDegree;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const lengthSquared = deltaX ** 2 + deltaY ** 2;
      const projected = lengthSquared > 0
        ? -((startX * deltaX) + (startY * deltaY)) / lengthSquared
        : 0;
      const fraction = Math.max(0, Math.min(1, projected));
      const point = {
        lat:start.lat + ((end.lat - start.lat) * fraction),
        lng:start.lng + ((end.lng - start.lng) * fraction),
      };
      const measuredKm = distanceKm(origin, point);
      if(!closest || measuredKm < closest.distanceKm){
        closest = { point, distanceKm:measuredKm, segmentIndex, fraction };
      }
    });
    return closest;
  }

  function currentPosition(navigatorLike){
    return new Promise((resolve, reject) => {
      const geolocation = navigatorLike && navigatorLike.geolocation;
      if(!geolocation || typeof geolocation.getCurrentPosition !== 'function'){
        reject(new Error('geolocation-unavailable'));
        return;
      }
      geolocation.getCurrentPosition(position => resolve({
        lat:position.coords.latitude,
        lng:position.coords.longitude,
        accuracyM:position.coords.accuracy,
      }), reject, {
        enableHighAccuracy:true,
        timeout:12000,
        maximumAge:60000,
      });
    });
  }

  async function planFromCurrent(navigatorLike, target, userAgent, maxKm){
    const origin = await currentPosition(navigatorLike);
    const assessment = assess(origin, target, maxKm);
    return {
      ...assessment,
      origin,
      target,
      url:assessment.allowed ? directionsUrl(origin, target, userAgent) : null,
    };
  }

  async function planToNearestRoute(navigatorLike, route, userAgent, maxKm){
    const origin = await currentPosition(navigatorLike);
    const nearest = nearestPointOnRoute(origin, route);
    if(!nearest) throw new Error('route-unavailable');
    const limitKm = Number.isFinite(maxKm) && maxKm > 0 ? maxKm : TRAIL_JOIN_MAX_KM;
    const allowed = Number.isFinite(nearest.distanceKm) && nearest.distanceKm <= limitKm;
    return {
      allowed,
      distanceKm:nearest.distanceKm,
      maxKm:limitKm,
      origin,
      target:nearest.point,
      accuracyM:origin.accuracyM,
      segmentIndex:nearest.segmentIndex,
      fraction:nearest.fraction,
      url:allowed ? directionsUrl(origin, nearest.point, userAgent, 'walking') : null,
    };
  }

  root.DoloPawsTrailAccess = Object.freeze({
    DEFAULT_MAX_KM,
    TRAIL_JOIN_MAX_KM,
    assess,
    currentPosition,
    directionsUrl,
    distanceKm,
    nearestPointOnRoute,
    planFromCurrent,
    planToNearestRoute,
  });
})(typeof window !== 'undefined' ? window : globalThis);
