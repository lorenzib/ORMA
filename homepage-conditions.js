(function(root, factory){
  const library = factory();
  if(typeof module === 'object' && module.exports) module.exports = library;
  if(root && root.document) root.DoloPawsHomeConditions = library.create(root);
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  // One forecast for the area on screen, not one per trail: the discovery list
  // holds well over a hundred routes and nobody needs a hundred requests to be
  // told it is hot.
  //
  // But a single valley reading says nothing useful about a ridge above it.
  // This catalogue spans roughly 900m to 2500m, and air cools about 6.5C per
  // 1000m, so the untreated number can be ten degrees wrong -- the whole
  // distance between "low" and "high" heat risk. Each trail's own summit
  // altitude corrects the area reading before it reaches the score.
  const LAPSE_C_PER_1000M = 6.5;

  function highestPoint(trail){
    const profile = trail && trail.elevationProfile;
    if(!Array.isArray(profile) || !profile.length) return null;
    let highest = null;
    for(const point of profile){
      const value = Number(point && point.elev);
      if(Number.isFinite(value) && (highest === null || value > highest)) highest = value;
    }
    return highest;
  }

  function shiftAll(values, delta){
    return Array.isArray(values) ? values.map(value => {
      const number = Number(value);
      return Number.isFinite(number) ? number - delta : value;
    }) : values;
  }

  function create(root){
    let area = null;

    function weather(){
      const api = root.DoloPawsWeatherWindow;
      return api && typeof api.currentConditions === 'function' ? api : null;
    }

    // Trails with no elevation profile keep the area reading unchanged. That
    // reports a summit as warmer than it is, which overstates heat risk rather
    // than understating it -- the safe direction to be wrong in.
    function deltaFor(trail){
      const summit = highestPoint(trail);
      if(summit === null || !Number.isFinite(area && area.baseAltitude)) return 0;
      return ((summit - area.baseAltitude) / 1000) * LAPSE_C_PER_1000M;
    }

    function conditionsAt(delta){
      const api = weather();
      if(!area || !api) return undefined;
      const snapshot = api.currentConditions({
        currentTime: area.currentTime,
        temperatureC: area.temperatureC - delta,
        hourlyTimes: area.hourlyTimes,
        hourlyTemps: shiftAll(area.hourlyTemps, delta),
        capturedAt: area.capturedAt,
      });
      return typeof api.scoringConditions === 'function' ? api.scoringConditions(snapshot) : snapshot;
    }

    function adopt(payload, at){
      const current = payload && payload.current;
      const hourly = payload && payload.hourly;
      if(!current || !Number.isFinite(Number(current.temperature_2m))) return false;
      area = {
        baseAltitude: Number.isFinite(Number(payload.elevation)) ? Number(payload.elevation) : null,
        currentTime: current.time,
        temperatureC: Number(current.temperature_2m),
        hourlyTimes: (hourly && hourly.time) || null,
        hourlyTemps: (hourly && hourly.temperature_2m) || null,
        capturedAt: Number.isFinite(Number(at)) ? Number(at) : Date.now(),
      };
      return true;
    }

    async function load(lat, lng, options){
      const settings = options || {};
      const request = typeof settings.fetch === 'function' ? settings.fetch : root.fetch;
      if(typeof request !== 'function' || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return false;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
        + '&current=temperature_2m&hourly=temperature_2m&forecast_days=1&timezone=auto';
      try{
        const response = await request(url);
        if(!response || !response.ok) return false;
        const accepted = adopt(await response.json(), settings.at);
        // Two independent renderers draw this page. Announcing the forecast lets
        // each repaint itself rather than one reaching into the other.
        if(accepted && root.dispatchEvent && typeof root.CustomEvent === 'function'){
          root.dispatchEvent(new root.CustomEvent('dolopaws-area-conditions-ready'));
        }
        return accepted;
      }catch(error){ return false; }
    }

    // What the score is handed for one trail, altitude-corrected and subject to
    // the shared staleness rule. Undefined when there is no usable forecast, so
    // the engine reports conditions as not included rather than guessing.
    function forTrail(trail){
      return conditionsAt(deltaFor(trail));
    }

    // The area headline. Deliberately not per trail: it describes the day over
    // the region on screen, which is the claim one forecast can actually carry.
    function band(){
      const conditions = conditionsAt(0);
      if(!conditions || conditions.status !== 'known') return null;
      if(conditions.heatRisk === 'high') return { tone:'high', detail:'Hot now. Prefer shade and water, or wait for the evening.' };
      if(conditions.heatRisk === 'moderate'){
        return { tone:'moderate', detail: conditions.hotFromLabel
          ? `Cooler now, heat rising from ${conditions.hotFromLabel}.`
          : 'Warm enough to plan around. Prefer shade and water.' };
      }
      return { tone:'low', detail:'Cool enough today across this area.' };
    }

    // Compare holds at most three trails and they can sit in different regions,
    // where one area reading would be meaningless. Three requests is affordable
    // where a hundred is not, so each trail gets its own -- still corrected from
    // that forecast's own grid elevation to the trail's summit.
    async function loadTrails(list, options){
      const settings = options || {};
      const request = typeof settings.fetch === 'function' ? settings.fetch : root.fetch;
      const api = weather();
      const found = new Map();
      if(typeof request !== 'function' || !api || !Array.isArray(list)) return found;
      await Promise.all(list.slice(0, 3).map(async trail => {
        if(!trail || !Number.isFinite(Number(trail.lat)) || !Number.isFinite(Number(trail.lng))) return;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${trail.lat}&longitude=${trail.lng}`
          + '&current=temperature_2m&hourly=temperature_2m&forecast_days=1&timezone=auto';
        try{
          const response = await request(url);
          if(!response || !response.ok) return;
          const payload = await response.json();
          const current = payload && payload.current;
          if(!current || !Number.isFinite(Number(current.temperature_2m))) return;
          const base = Number.isFinite(Number(payload.elevation)) ? Number(payload.elevation) : null;
          const summit = highestPoint(trail);
          const delta = (summit === null || base === null) ? 0 : ((summit - base) / 1000) * LAPSE_C_PER_1000M;
          const snapshotAt = Number.isFinite(Number(settings.at)) ? Number(settings.at) : Date.now();
          const conditions = api.currentConditions({
            currentTime: current.time,
            temperatureC: Number(current.temperature_2m) - delta,
            hourlyTimes: (payload.hourly && payload.hourly.time) || null,
            hourlyTemps: shiftAll((payload.hourly && payload.hourly.temperature_2m) || null, delta),
            capturedAt: snapshotAt,
          });
          found.set(trail.id, typeof api.scoringConditions === 'function'
            ? api.scoringConditions(conditions) : conditions);
        }catch(error){ /* one trail without a forecast is scored without one */ }
      }));
      return found;
    }

    function snapshot(){ return area; }

    return { load, loadTrails, forTrail, band, snapshot };
  }

  return { create, highestPoint, LAPSE_C_PER_1000M };
});
