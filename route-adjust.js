// "Adjust this walk": a reader starts the route planner from one of ORMA's
// walks, moves it, and keeps their own version.
//
// The seal stays with the checked walk. Our Verified seal covers one exact
// line, so an edited copy is never Verified: it is "Your version of …", it
// says how much of it still follows the checked line, and the parts that leave
// it are drawn apart. It is still scored for the dog, honestly:
//
// - Distance, climb and the height profile are measured on the new line by the
//   router, so they describe the walk the reader will actually do.
// - The walk's other facts (heat, shade, exposure, surfaces, dog rules, lifts,
//   season) are carried over from the original walk, because most of the new
//   line is that walk. None of them is carried as reviewed: the copy has no
//   verified categories, so the engine treats every fact as unreviewed, lowers
//   its confidence and offers no reassurance it cannot stand behind.
// - Below half on the checked line there is too little of the walk left to
//   borrow its facts, so the copy is not scored at all.
//
// The score is the engine's (recommendTrail): this file only builds the trail
// record it reads, and adds no rule of its own about what suits a dog.
(function(root){
  'use strict';

  // The planner holds 25 points; one is left free for the reader to add.
  const MAX_SEED_POINTS = 24;
  // About one point every 400 m: enough that the router follows the walk's
  // own paths rather than a shortcut, few enough to drag by hand.
  const SEED_SPACING_M = 400;
  // A walk whose ends lie this close together is walked as a loop.
  const LOOP_CLOSE_M = 150;
  // How far the new line may sit from the checked one and still be on it:
  // the two are drawn from different maps, so they never coincide exactly.
  const ON_LINE_M = 40;
  // Below this share of the walk, its facts are not the new route's.
  const MIN_SCORED_SHARE = 0.5;
  // Height profile step for the score. The engine reads a pitch only when it
  // holds over 300 m, so the step is a little longer than that.
  const PROFILE_STEP_KM = 0.4;
  // Water within this distance of the new line is still on the way.
  const WATER_NEAR_M = 150;

  const LOOP_SHAPES = new Set(['loop', 'circular', 'lollipop']);

  function toPoint(value){
    if(Array.isArray(value)) return { lat:Number(value[0]), lng:Number(value[1]) };
    return value ? { lat:Number(value.lat), lng:Number(value.lng) } : null;
  }
  function valid(point){
    return point && Number.isFinite(point.lat) && Number.isFinite(point.lng);
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

  // Distance from a point to a segment, on a local flat projection; fine at
  // the scale of a walk.
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
    const x = ax + t * dx;
    const y = ay + t * dy;
    return Math.sqrt(x * x + y * y) * 111320;
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

  function lineLength(line){
    let total = 0;
    for(let i = 1; i < line.length; i++) total += metres(line[i - 1], line[i]);
    return total;
  }

  function pointAtKm(line, km){
    if(!Number.isFinite(km) || line.length < 2) return null;
    const target = km * 1000;
    let walked = 0;
    for(let i = 1; i < line.length; i++){
      const d = metres(line[i - 1], line[i]);
      if(walked + d >= target){
        const t = d ? (target - walked) / d : 0;
        return {
          lat:line[i - 1].lat + (line[i].lat - line[i - 1].lat) * t,
          lng:line[i - 1].lng + (line[i].lng - line[i - 1].lng) * t,
        };
      }
      walked += d;
    }
    return line[line.length - 1];
  }

  // The shape the planner should draw this walk as.
  function shapeOf(trail, line){
    const declared = trail && trail.routeShape;
    if(declared === 'out-and-back') return 'out-and-back';
    if(LOOP_SHAPES.has(declared)) return 'loop';
    if(declared === 'point-to-point') return 'point-to-point';
    if(line.length > 2 && metres(line[0], line[line.length - 1]) <= LOOP_CLOSE_M) return 'loop';
    return 'point-to-point';
  }

  // The points the planner starts from. A loop's last point is its first, and
  // the planner closes the loop itself, so the line is sampled short of its
  // end. An out-and-back walk is sampled on the way out only: the planner
  // walks the return.
  function seed(trail){
    let line = linePoints(trail && trail.path);
    if(line.length < 2) return null;
    const shape = shapeOf(trail, line);
    if(shape === 'out-and-back'){
      // A line stored there and back turns at its farthest point from the start.
      let far = 0;
      let farthest = 0;
      line.forEach((point, index) => {
        const d = metres(line[0], point);
        if(d > far){ far = d; farthest = index; }
      });
      if(farthest > 0 && metres(line[0], line[line.length - 1]) <= LOOP_CLOSE_M) line = line.slice(0, farthest + 1);
    }
    const total = lineLength(line);
    const wanted = Math.max(shape === 'loop' ? 3 : 2,
      Math.min(MAX_SEED_POINTS, Math.round(total / SEED_SPACING_M) + 1));
    // A loop samples n points round the whole line and drops the last (the start
    // again); an open walk keeps both ends.
    const steps = shape === 'loop' ? wanted : wanted - 1;
    const targets = Array.from({ length:wanted }, (unused, index) => total * index / steps);
    const points = [];
    let walked = 0;
    let target = 0;
    for(let i = 0; i < line.length && target < targets.length; i++){
      if(i > 0) walked += metres(line[i - 1], line[i]);
      while(target < targets.length && walked >= targets[target] - 1e-6){
        points.push({ lat:line[i].lat, lng:line[i].lng });
        target += 1;
      }
    }
    if(shape !== 'loop' && points.length < wanted) points.push({ ...line[line.length - 1] });
    return { shape, points, line };
  }

  // How much of the new line follows the checked one, by length, and the
  // stretches that leave it (as [lat, lng] lines, for drawing apart).
  function compare(newPath, checkedPath){
    const route = linePoints(newPath);
    const checked = linePoints(checkedPath);
    if(route.length < 2 || checked.length < 2) return { share:0, totalM:0, onM:0, offLines:[] };
    // Long legs are sampled, so a straight road across the walk is not
    // counted as on it because both its ends happen to be.
    const samples = [route[0]];
    for(let i = 1; i < route.length; i++){
      const d = metres(route[i - 1], route[i]);
      const parts = Math.max(1, Math.ceil(d / 25));
      for(let p = 1; p <= parts; p++){
        samples.push({
          lat:route[i - 1].lat + (route[i].lat - route[i - 1].lat) * p / parts,
          lng:route[i - 1].lng + (route[i].lng - route[i - 1].lng) * p / parts,
        });
      }
    }
    const on = samples.map(point => toLine(point, checked) <= ON_LINE_M);
    let totalM = 0;
    let onM = 0;
    const offLines = [];
    let current = null;
    for(let i = 1; i < samples.length; i++){
      const d = metres(samples[i - 1], samples[i]);
      totalM += d;
      const stays = on[i - 1] && on[i];
      if(stays){
        onM += d;
        if(current){ offLines.push(current); current = null; }
      }else{
        if(!current) current = [[samples[i - 1].lat, samples[i - 1].lng]];
        current.push([samples[i].lat, samples[i].lng]);
      }
    }
    if(current) offLines.push(current);
    return { share:totalM ? onM / totalM : 0, totalM, onM, offLines };
  }

  // The router gives a height for every point of the line; the score wants a
  // profile in km steps, like a trail's own.
  function profileOf(path, heights){
    const line = linePoints(path);
    if(!Array.isArray(heights) || heights.length !== line.length || line.length < 2) return [];
    if(heights.some(value => !Number.isFinite(Number(value)))) return [];
    const profile = [{ km:0, elev:Math.round(Number(heights[0])) }];
    let walked = 0;
    let next = PROFILE_STEP_KM * 1000;
    for(let i = 1; i < line.length; i++){
      walked += metres(line[i - 1], line[i]);
      if(walked >= next || i === line.length - 1){
        profile.push({ km:Math.round(walked) / 1000, elev:Math.round(Number(heights[i])) });
        next = walked + PROFILE_STEP_KM * 1000;
      }
    }
    return profile;
  }

  // The trail record the engine scores, or null when too little of the walk is
  // left to carry its facts over.
  function scoringRecord(trail, route, comparison){
    if(!trail || !route || !comparison || comparison.share < MIN_SCORED_SHARE) return null;
    const path = linePoints(route.path).map(point => [point.lat, point.lng]);
    if(path.length < 2) return null;
    const km = Math.round((Number(route.distanceM) || lineLength(linePoints(path))) / 100) / 10;
    const ascent = Number.isFinite(route.ascentM) ? Math.round(route.ascentM) : null;
    const profile = profileOf(path, route.heights);
    const returns = route.shape === 'loop' || route.shape === 'out-and-back';
    const back = root.ORMARouteReturn;
    let hours = null;
    if(back && typeof back.ruleHours === 'function' && Number.isFinite(ascent)){
      const first = profile.length ? profile[0].elev : null;
      const last = profile.length ? profile[profile.length - 1].elev : null;
      const descent = returns ? ascent
        : Number.isFinite(first) && Number.isFinite(last) ? Math.max(0, ascent - (last - first)) : ascent;
      hours = Math.round(back.ruleHours(km, ascent, descent) * 100) / 100;
    }
    // Steepness: with a profile of its own, the new line is read from it (the
    // engine keeps the gentler of the stored rank and what the profile shows,
    // so the stored rank starts at the steepest). Without one, the walk's own
    // rank stands only when the new line is nearly all the walk.
    const terrainRank = profile.length > 1 ? 2
      : comparison.share >= 0.9 && Number.isFinite(trail.terrainRank) ? trail.terrainRank : 2;
    // Water is recorded by its km along the walk; it stays only where the new
    // line still passes it.
    const checked = linePoints(trail.path);
    const newLine = linePoints(path);
    const water = Array.isArray(trail.waterSources)
      ? trail.waterSources.filter(source => {
        const point = Number.isFinite(Number(source && source.lat))
          ? toPoint(source) : pointAtKm(checked, Number(source && source.km));
        return valid(point) && toLine(point, newLine) <= WATER_NEAR_M;
      })
      : undefined;
    return {
      id:`custom-${trail.id}`,
      name:trail.name,
      curated:false,
      path,
      routeShape:route.shape === 'loop' ? 'loop' : route.shape,
      distance:km,
      elevation:ascent,
      hours,
      elevationProfile:profile.length > 1 ? profile : undefined,
      terrainRank,
      // Carried over from the walk, unreviewed (no verified categories).
      heatRisk:trail.heatRisk,
      shadeCoverage:trail.shadeCoverage,
      exposure:trail.exposure,
      safetyLevel:trail.safetyLevel,
      surfaceHazards:trail.surfaceHazards,
      liftAccess:trail.liftAccess,
      season:trail.season,
      waterSources:water,
      desc:trail.desc,
      tips:trail.tips,
      region:trail.region,
    };
  }

  const api = Object.freeze({
    MAX_SEED_POINTS, ON_LINE_M, MIN_SCORED_SHARE,
    seed, compare, profileOf, scoringRecord, shapeOf,
  });
  root.ORMARouteAdjust = api;
  if(typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
