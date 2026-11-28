// "Fit for your dog" on Draw a route: an estimate of how a freshly drawn line
// suits the reader's dog, before anyone has checked it.
//
// The score is the engine's: this file builds the trail record it reads from
// what the router measured on the line, and nothing else.
//
// - Distance and climb are the router's figures for the whole walk, the way
//   back included for a loop or an out-and-back.
// - Steepness is read from the router's height for every point, the same way
//   an imported OpenStreetMap walk's is (route-adjust.js profileOf).
// - Walking time follows the same hiking rule as every walk (route-return.js).
// - Nothing else is known about a drawn line: drops, heat, shade, what the
//   path is like underfoot and the local dog rules stay unknown, and the
//   engine already treats an unknown as "cannot promise", never as "fine".
//   It also holds an unchecked route below a strong option, so the seal's
//   words never reach a draft.
//
// A draft says its verdict in its own words, about the dog's limits rather
// than about the trail: within the dog's range, a stretch, or beyond it.
//
// Mapped water near the line is said apart from the score: a fountain on the
// map may be dry or shut for the winter, so it lowers nothing and promises
// nothing.
(function(root){
  'use strict';

  // Below this, a line says too little about steepness or water to rate.
  const MIN_RATED_M = 1000;
  // Water this close to the line is on the way.
  const WATER_NEAR_M = 150;

  function toPoint(value){
    if(Array.isArray(value)) return { lat:Number(value[0]), lng:Number(value[1]) };
    return value ? { lat:Number(value.lat), lng:Number(value.lng) } : null;
  }
  function valid(point){
    return Boolean(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng);
  }
  function linePoints(path){
    return (Array.isArray(path) ? path : []).map(toPoint).filter(valid);
  }

  function metres(a, b){
    const rad = value => value * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function toSegment(point, start, end){
    const k = Math.cos(point.lat * Math.PI / 180);
    const ax = (start.lng - point.lng) * k;
    const ay = start.lat - point.lat;
    const bx = (end.lng - point.lng) * k;
    const by = end.lat - point.lat;
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
    return Math.hypot(ax + t * dx, ay + t * dy) * 111320;
  }

  function toLine(point, line){
    if(line.length === 1) return metres(point, line[0]);
    let best = Infinity;
    for(let i = 1; i < line.length; i++){
      const d = toSegment(point, line[i - 1], line[i]);
      if(d < best) best = d;
    }
    return best;
  }

  // Whether the line is long enough to rate.
  function rateable(route){
    return Boolean(route) && Number.isFinite(Number(route.distanceM)) && Number(route.distanceM) >= MIN_RATED_M
      && linePoints(route.path).length >= 2;
  }

  function profileOf(path, heights){
    const adjust = root.ORMARouteAdjust;
    return adjust && typeof adjust.profileOf === 'function' ? adjust.profileOf(path, heights) : [];
  }

  // The trail record the engine scores, or null for a line too short to rate.
  function draftRecord(route, shape){
    if(!rateable(route)) return null;
    const path = linePoints(route.path).map(point => [point.lat, point.lng]);
    const km = Math.round(Number(route.distanceM) / 100) / 10;
    const ascent = Number.isFinite(route.ascentM) ? Math.round(route.ascentM) : null;
    const profile = profileOf(path, route.heights);
    const routeShape = shape === 'loop' || shape === 'out-and-back' ? shape : 'point-to-point';
    // The router's figures already cover the way back of a loop or an
    // out-and-back, so the descent is the climb; a one-way line comes down its
    // climb less the height it gains.
    let descent = null;
    if(Number.isFinite(ascent)){
      if(routeShape !== 'point-to-point') descent = ascent;
      else if(profile.length > 1) descent = Math.max(0, ascent - (profile[profile.length - 1].elev - profile[0].elev));
    }
    const back = root.ORMARouteReturn;
    const hours = back && typeof back.ruleHours === 'function' && Number.isFinite(ascent)
      ? Math.round(back.ruleHours(km, ascent, Number.isFinite(descent) ? descent : ascent) * 100) / 100
      : null;
    return {
      id:'draft-route',
      curated:false,
      path,
      routeShape,
      distance:km,
      elevation:ascent,
      descent:Number.isFinite(descent) ? descent : undefined,
      hours,
      elevationProfile:profile.length > 1 ? profile : undefined,
      // With a height profile, the engine keeps the gentler of this rank and
      // what the profile shows, so starting from the steepest lets the line's
      // own heights decide. Without heights, steepness is unknown.
      terrainRank:profile.length > 1 ? 2 : null,
    };
  }

  // The engine's result for a draft, scored on the line as drawn. The page's
  // recommendTrail() would turn a one-way walk into a there-and-back, which
  // is right for a published walk read either way, and wrong for a line the
  // reader drew one way on purpose.
  function recommend(record, subject){
    const adapters = root.DoloPawsRecommendationAdaptersV1;
    if(!record || !adapters || typeof adapters.recommendLegacyTrail !== 'function') return null;
    return adapters.recommendLegacyTrail(record, subject || {});
  }

  // Within the dog's range, a stretch, or beyond it. The engine holds every
  // unchecked route below a strong option; that cap is about the evidence,
  // not the dog, so it does not make a draft a stretch.
  function verdictOf(recommendation){
    if(!recommendation) return null;
    if((recommendation.hardStops || []).length || recommendation.category === 'not-recommended') return 'beyond';
    const costs = (recommendation.cautions || []).filter(item => item
      && Number.isFinite(item.impact) && item.impact < 0
      && !String(item.code || '').startsWith('evidence.'));
    return costs.length ? 'stretch' : 'within';
  }

  // Mapped water points (GeoJSON features) within reach of the line, nearest
  // first. `covered` says whether the line lies inside the area the water map
  // covers at all: outside it, finding nothing says nothing.
  function waterNear(path, features){
    const line = linePoints(path);
    const points = (Array.isArray(features) ? features : [])
      .map(feature => {
        const coords = feature && feature.geometry && feature.geometry.type === 'Point'
          ? feature.geometry.coordinates : null;
        return coords ? { lat:Number(coords[1]), lng:Number(coords[0]) } : null;
      })
      .filter(valid);
    if(line.length < 2 || !points.length) return { covered:false, count:0 };
    let south = Infinity; let north = -Infinity; let west = Infinity; let east = -Infinity;
    points.forEach(point => {
      south = Math.min(south, point.lat); north = Math.max(north, point.lat);
      west = Math.min(west, point.lng); east = Math.max(east, point.lng);
    });
    const covered = line.every(point => point.lat >= south && point.lat <= north && point.lng >= west && point.lng <= east);
    // A quick box first: the full distance check is only for points near it.
    const pad = 0.003;
    let lineSouth = Infinity; let lineNorth = -Infinity; let lineWest = Infinity; let lineEast = -Infinity;
    line.forEach(point => {
      lineSouth = Math.min(lineSouth, point.lat); lineNorth = Math.max(lineNorth, point.lat);
      lineWest = Math.min(lineWest, point.lng); lineEast = Math.max(lineEast, point.lng);
    });
    const count = points.filter(point => point.lat >= lineSouth - pad && point.lat <= lineNorth + pad
      && point.lng >= lineWest - pad * 1.5 && point.lng <= lineEast + pad * 1.5
      && toLine(point, line) <= WATER_NEAR_M).length;
    return { covered, count };
  }

  function plain(text, vars){
    return vars ? String(text).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match)) : String(text);
  }

  // The card's rows: what lowers the fit first, then what fits, then the
  // facts that are not scored (time, mapped water).
  //
  // `presented` is DoloPawsRecommendationDecision.present() of the result; its
  // rows are the trail page's, in the same words. The evidence cap is left
  // out: the card's own footer says the line is unchecked, and "we haven't
  // checked this trail" reads oddly about a route the reader just drew.
  // `say` translates an English sentence (i18n phrase); `num` writes a number
  // the reader's way.
  function cardRows(input){
    const say = typeof input.say === 'function' ? input.say : plain;
    const num = typeof input.num === 'function' ? input.num : value => value;
    const name = input.name || '';
    const record = input.record || {};
    const presented = input.presented || {};
    const order = { stop:0, cost:1, note:2, ok:3, info:4 };
    const rows = (Array.isArray(presented.factorRows) ? presented.factorRows : [])
      .filter(row => row && !String(row.code || '').startsWith('evidence.'))
      .map(row => ({ tone:row.tone, topic:row.topic, detail:row.detail, code:row.code }));

    // A healthy dog's steepness costs nothing and the engine offers no
    // reassurance on an unchecked line, so the level is said as a fact.
    if(!rows.some(row => String(row.code || '').startsWith('trail.terrain.'))){
      const adapters = root.DoloPawsRecommendationAdaptersV1;
      const rank = adapters ? adapters.sustainedTerrainRank(record) : null;
      const levels = ['Gentle', 'Moderately steep', 'Steep'];
      if(Number.isFinite(rank) && Array.isArray(record.elevationProfile)){
        const level = say(levels[rank]);
        const steepest = adapters.steepestPercent(record);
        rows.push({ tone:'ok', topic:say('Steepness'), code:'draft.steepness',
          detail:Number.isFinite(steepest) && steepest > 0
            ? say('{level}, steepest stretch about {steepest}%', { level, steepest:num(steepest) })
            : level });
      }
    }

    const back = root.ORMARouteReturn;
    if(Number.isFinite(record.hours) && back && typeof back.formatDuration === 'function'){
      const time = back.formatDuration(record.hours);
      if(time) rows.push({ tone:'info', topic:say('Walking time'), code:'draft.time',
        detail:say('About {time}', { time:num(time) }) });
    }

    const water = input.water;
    if(water && water.count > 0){
      rows.push({ tone:'info', topic:say('Water'), code:'draft.water',
        detail:water.count === 1
          ? say('One mapped water point near your line. It may be dry, so carry water too.')
          : say('{count} mapped water points near your line. They may be dry, so carry water too.', { count:num(water.count) }) });
    }else if(water && water.covered){
      rows.push({ tone:'note', topic:say('Water'), code:'draft.water',
        detail:say('No mapped water near your line. Carry enough for {name}.', { name }) });
    }

    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => (order[a.row.tone] ?? 5) - (order[b.row.tone] ?? 5) || a.index - b.index)
      .map(entry => entry.row);
  }

  const api = Object.freeze({ MIN_RATED_M, WATER_NEAR_M, rateable, draftRecord, recommend, verdictOf, waterNear, cardRows });
  root.ORMARouteFit = api;
  if(typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
