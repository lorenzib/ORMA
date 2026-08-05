(function(root){
  'use strict';

  const DEFAULT_MAX_KM = 100;

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

  function directionsUrl(origin, target, userAgent){
    if(!finiteCoordinate(origin) || !finiteCoordinate(target)) return null;
    const apple = /iPhone|iPad|iPod|Macintosh/.test(String(userAgent || ''));
    return apple
      ? `https://maps.apple.com/?saddr=${origin.lat},${origin.lng}&daddr=${target.lat},${target.lng}`
      : `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${target.lat},${target.lng}&travelmode=driving`;
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

  root.DoloPawsTrailAccess = Object.freeze({
    DEFAULT_MAX_KM,
    assess,
    currentPosition,
    directionsUrl,
    distanceKm,
    planFromCurrent,
  });
})(typeof window !== 'undefined' ? window : globalThis);
