(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsOfflineElevation = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  function validProfile(profile, trailId){
    return profile && profile.schemaVersion === 1 && profile.trailId === trailId &&
      Number.isFinite(profile.distanceKm) && profile.distanceKm > 0 &&
      Number.isFinite(profile.ascentM) && Array.isArray(profile.points) &&
      profile.points.length >= 2 && profile.points.every((point, index) =>
        Number.isFinite(point.km) && Number.isFinite(point.elev) && point.km >= 0 &&
        (index === 0 || point.km > profile.points[index - 1].km)
      ) && Math.abs(profile.points[profile.points.length - 1].km - profile.distanceKm) < 0.05;
  }

  function elevationAtKm(profile, km){
    const points = profile && profile.points;
    if(!Array.isArray(points) || points.length < 2 || !Number.isFinite(km)) return null;
    const bounded = Math.max(points[0].km, Math.min(km, points[points.length - 1].km));
    for(let index = 1; index < points.length; index++){
      if(bounded <= points[index].km){
        const previous = points[index - 1];
        const current = points[index];
        const span = current.km - previous.km;
        const fraction = span > 0 ? (bounded - previous.km) / span : 0;
        return previous.elev + (current.elev - previous.elev) * fraction;
      }
    }
    return points[points.length - 1].elev;
  }

  function chartGeometry(profile, width, height){
    width = Number.isFinite(width) ? width : 600;
    height = Number.isFinite(height) ? height : 150;
    const points = profile.points;
    const elevations = points.map(point => point.elev);
    const low = Math.min(...elevations);
    const high = Math.max(...elevations);
    const range = Math.max(1, high - low);
    const left = 12, right = width - 12, top = 12, bottom = height - 12;
    const xForKm = km => left + (Math.max(0, Math.min(km, profile.distanceKm)) /
      profile.distanceKm) * (right - left);
    const yForElevation = elevation => bottom - ((elevation - low) / range) * (bottom - top);
    const line = points.map((point, index) =>
      `${index ? 'L' : 'M'} ${xForKm(point.km).toFixed(1)} ${yForElevation(point.elev).toFixed(1)}`
    ).join(' ');
    return {
      low,
      high,
      line,
      area:`${line} L ${right} ${bottom} L ${left} ${bottom} Z`,
      xForKm,
    };
  }

  return { validProfile, elevationAtKm, chartGeometry };
});
