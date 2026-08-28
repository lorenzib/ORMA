(function(root){
  'use strict';

  const DEFAULT_MAX_KM = 100;
  const TRAIL_JOIN_MAX_KM = 5;
  const MAX_GPS_ACCURACY_M = 500;
  const NEAR_ROUTE_FALLBACK_MAX_M = 150;

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

  function recommendedTrailAccess(trail){
    if(!trail) return null;
    const declared = finiteCoordinate(trail.startPoint) ? trail.startPoint : null;
    const firstPathPoint = Array.isArray(trail.path) && trail.path.length
      ? normalizeRoutePoint(trail.path[0])
      : null;
    const fallback = finiteCoordinate(trail) ? trail : firstPathPoint;
    const point = declared || fallback;
    if(!point) return null;
    return {
      point:{ lat:point.lat, lng:point.lng },
      label:declared && declared.label
        ? declared.label
        : (trail.curated === false ? 'Mapped route start' : 'Recommended starting point'),
      kind:trail.curated === false ? 'mapped-start' : 'recommended-start',
    };
  }

  function bearing(first, second){
    const rad = Math.PI / 180;
    const lat1 = first.lat * rad;
    const lat2 = second.lat * rad;
    const deltaLng = (second.lng - first.lng) * rad;
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function signedBearingChange(first, second){
    return ((second - first + 540) % 360) - 180;
  }

  function routeInstructions(path){
    if(!Array.isArray(path)) return [];
    const points = path.map(normalizeRoutePoint).filter(Boolean);
    if(points.length < 2) return [];
    const segments = [];
    for(let index = 0; index < points.length - 1; index += 1){
      const distanceM = distanceKm(points[index], points[index + 1]) * 1000;
      if(!Number.isFinite(distanceM) || distanceM < 1) continue;
      segments.push({
        distanceM,
        bearing:bearing(points[index], points[index + 1]),
      });
    }
    if(!segments.length) return [];

    const steps = [];
    let action = 'Follow the mapped path';
    let heading = segments[0].bearing;
    let distanceM = 0;
    segments.forEach((segment, index) => {
      const change = signedBearingChange(heading, segment.bearing);
      if(index > 0 && Math.abs(change) >= 35){
        steps.push({ action, distanceM:Math.round(distanceM) });
        const side = change > 0 ? 'right' : 'left';
        action = `${Math.abs(change) < 75 ? 'Bear' : 'Turn'} ${side}`;
        distanceM = 0;
      }
      distanceM += segment.distanceM;
      heading = segment.bearing;
    });
    if(distanceM > 0) steps.push({ action, distanceM:Math.round(distanceM) });
    steps.push({ action:'Join the trail', distanceM:0 });
    return steps;
  }

  async function planTrailEntry(navigatorLike, trail, graph, router, userAgent, options){
    options = options || {};
    const origin = await currentPosition(navigatorLike);
    const accuracyM = Number(origin.accuracyM);
    if(Number.isFinite(accuracyM) && accuracyM > MAX_GPS_ACCURACY_M){
      return {
        allowed:false,
        mode:'unreliable-location',
        origin,
        accuracyM,
        maxAccuracyM:MAX_GPS_ACCURACY_M,
      };
    }

    const maxRouteDistanceM = Number.isFinite(options.maxRouteDistanceM)
      ? options.maxRouteDistanceM
      : TRAIL_JOIN_MAX_KM * 1000;
    const maxSnapDistanceM = Number.isFinite(options.maxSnapDistanceM)
      ? options.maxSnapDistanceM
      : Math.min(120, Math.max(35, (Number.isFinite(accuracyM) ? accuracyM : 20) + 15));
    if(graph && router && typeof router.routeToTrail === 'function'){
      const mapped = router.routeToTrail(origin, graph, { maxRouteDistanceM, maxSnapDistanceM });
      if(mapped){
        return {
          ...mapped,
          allowed:true,
          mode:'mapped-footpath',
          origin,
          accuracyM,
          distanceKm:mapped.distanceM / 1000,
          maxKm:maxRouteDistanceM / 1000,
          instructions:routeInstructions(mapped.path),
          url:null,
        };
      }
    }

    // If the hiker is already beside the published route, direct the maps app
    // to the closest point on that route instead of sending them kilometres
    // away to its official start. Keep this deliberately short-range: without
    // a connected footpath graph ORMA must not invent an approach across
    // private land, buildings, water, or other unmapped obstacles.
    const nearest = nearestPointOnRoute(origin, trail && trail.path);
    const nearbyLimitM = Number.isFinite(options.maxNearbyRouteDistanceM)
      ? options.maxNearbyRouteDistanceM
      : Math.min(
        NEAR_ROUTE_FALLBACK_MAX_M,
        Math.max(40, (Number.isFinite(accuracyM) ? accuracyM : 20) + 20)
      );
    if(nearest && nearest.distanceKm * 1000 <= nearbyLimitM){
      return {
        allowed:true,
        mode:'nearest-route',
        origin,
        target:nearest.point,
        targetLabel:'Nearest point on this trail',
        targetKind:'nearest-route-point',
        accuracyM,
        distanceKm:nearest.distanceKm,
        maxKm:nearbyLimitM / 1000,
        segmentIndex:nearest.segmentIndex,
        fraction:nearest.fraction,
        url:directionsUrl(origin, nearest.point, userAgent, 'walking'),
      };
    }

    const access = recommendedTrailAccess(trail);
    if(!access){
      return { allowed:false, mode:'unavailable', origin, accuracyM };
    }
    const limitKm = Number.isFinite(options.maxFallbackDistanceKm)
      ? options.maxFallbackDistanceKm
      : TRAIL_JOIN_MAX_KM;
    const fallback = assess(origin, access.point, limitKm);
    return {
      ...fallback,
      mode:'recommended-start',
      origin,
      target:access.point,
      targetLabel:access.label,
      targetKind:access.kind,
      accuracyM,
      url:fallback.allowed ? directionsUrl(origin, access.point, userAgent, 'walking') : null,
    };
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

  async function planMappedPoint(navigatorLike, target, graph, router, userAgent, options){
    options = options || {};
    const origin = finiteCoordinate(options.origin)
      ? options.origin
      : await currentPosition(navigatorLike);
    const accuracyM = Number(origin.accuracyM);
    if(Number.isFinite(accuracyM) && accuracyM > MAX_GPS_ACCURACY_M){
      return { allowed:false, mode:'unreliable-location', origin, accuracyM };
    }
    if(graph && router && typeof router.routeToPoint === 'function'){
      const mapped = router.routeToPoint(origin, target, graph, {
        maxRouteDistanceM:Number.isFinite(options.maxRouteDistanceM) ? options.maxRouteDistanceM : 5000,
        maxSnapDistanceM:Number.isFinite(options.maxSnapDistanceM)
          ? options.maxSnapDistanceM
          : Math.min(120, Math.max(35, (Number.isFinite(accuracyM) ? accuracyM : 20) + 15)),
        maxTargetSnapDistanceM:Number.isFinite(options.maxTargetSnapDistanceM)
          ? options.maxTargetSnapDistanceM
          : 90,
      });
      if(mapped){
        return {
          ...mapped,
          allowed:true,
          mode:'mapped-point',
          origin,
          accuracyM,
          distanceKm:mapped.distanceM / 1000,
          instructions:routeInstructions(mapped.path),
          url:null,
        };
      }
    }
    const fallback = assess(origin, target, Number.isFinite(options.maxFallbackDistanceKm)
      ? options.maxFallbackDistanceKm
      : TRAIL_JOIN_MAX_KM);
    return {
      ...fallback,
      mode:'external-point',
      origin,
      target,
      accuracyM,
      url:fallback.allowed ? directionsUrl(origin, target, userAgent, 'walking') : null,
    };
  }

  root.DoloPawsTrailAccess = Object.freeze({
    DEFAULT_MAX_KM,
    TRAIL_JOIN_MAX_KM,
    MAX_GPS_ACCURACY_M,
    NEAR_ROUTE_FALLBACK_MAX_M,
    assess,
    currentPosition,
    directionsUrl,
    distanceKm,
    nearestPointOnRoute,
    planFromCurrent,
    planMappedPoint,
    planToNearestRoute,
    planTrailEntry,
    recommendedTrailAccess,
    routeInstructions,
  });
})(typeof window !== 'undefined' ? window : globalThis);
