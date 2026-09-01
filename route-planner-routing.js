(function(root){
  'use strict';

  const DEFAULT_ENDPOINT = 'https://brouter.de/brouter';
  const DEFAULT_PROFILE = 'hiking-mountain';

  function validPoint(point){
    return point && Number.isFinite(Number(point.lng)) && Number.isFinite(Number(point.lat));
  }

  function normalisePoints(points, closeLoop){
    const routePoints = (points || []).filter(validPoint).map(point => ({
      lng:Number(point.lng),
      lat:Number(point.lat),
    }));
    if(closeLoop && routePoints.length > 2){
      const first = routePoints[0];
      const last = routePoints[routePoints.length - 1];
      if(first.lng !== last.lng || first.lat !== last.lat) routePoints.push({ ...first });
    }
    return routePoints;
  }

  function haversine(first, second){
    const radians = value => value * Math.PI / 180;
    const earthRadius = 6371000;
    const dLat = radians(second.lat - first.lat);
    const dLng = radians(second.lng - first.lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(dLng / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function pathDistance(path){
    return path.slice(1).reduce((sum, point, index) => sum + haversine(path[index], point), 0);
  }

  function routeError(message, code){
    const error = new Error(message);
    error.code = code;
    return error;
  }

  async function route(points, options){
    const settings = options || {};
    const routePoints = normalisePoints(points, Boolean(settings.closeLoop));
    if(routePoints.length < 2) throw routeError('Choose at least two points.', 'too-few-points');

    const endpoint = settings.endpoint || DEFAULT_ENDPOINT;
    const url = new URL(endpoint);
    url.searchParams.set('lonlats', routePoints.map(point => `${point.lng},${point.lat}`).join('|'));
    url.searchParams.set('profile', settings.profile || DEFAULT_PROFILE);
    // Keep dog-walk drafts away from mapped SAC T3+ paths. Unknown or
    // untagged difficulty still requires the local checks stated in the UI.
    url.searchParams.set('profile:SAC_scale_limit', '2');
    url.searchParams.set('profile:SAC_scale_preferred', '1');
    url.searchParams.set('alternativeidx', '0');
    url.searchParams.set('format', 'geojson');

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutMs = Number(settings.timeoutMs) || 20000;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response;
    try{
      response = await (settings.fetch || root.fetch)(url.toString(), {
        mode:'cors',
        signal:controller ? controller.signal : undefined,
      });
    }catch(error){
      throw routeError(error && error.name === 'AbortError'
        ? 'The walking route took too long to calculate.'
        : 'The walking route service is unavailable.', 'network');
    }finally{
      if(timeout) clearTimeout(timeout);
    }
    if(!response || !response.ok) throw routeError('No mapped walking route connects those points.', 'no-route');

    const geojson = await response.json();
    const feature = geojson && Array.isArray(geojson.features) ? geojson.features[0] : null;
    const coordinates = feature && feature.geometry && feature.geometry.type === 'LineString'
      ? feature.geometry.coordinates : null;
    if(!Array.isArray(coordinates) || coordinates.length < 2){
      throw routeError('No mapped walking route connects those points.', 'no-route');
    }
    const path = coordinates.map(coordinate => ({ lng:Number(coordinate[0]), lat:Number(coordinate[1]) }))
      .filter(validPoint);
    if(path.length < 2) throw routeError('The walking route response was incomplete.', 'invalid-route');

    const reportedDistance = Number(feature.properties && feature.properties['track-length']);
    const distanceM = Number.isFinite(reportedDistance) ? reportedDistance : pathDistance(path);
    if(Number.isFinite(settings.maxDistanceM) && distanceM > settings.maxDistanceM){
      throw routeError('That draft is longer than the current 30 km planning limit.', 'too-long');
    }
    return {
      path,
      distanceM,
      closed:Boolean(settings.closeLoop),
      source:'openstreetmap-brouter',
    };
  }

  const api = Object.freeze({ DEFAULT_ENDPOINT, DEFAULT_PROFILE, normalisePoints, pathDistance, route });
  root.DoloPawsRoutePlannerRouting = api;
  if(typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
