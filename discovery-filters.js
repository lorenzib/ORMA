(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsDiscoveryFilters = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  const DISTANCES = [3, 5, 6, 10, 20];
  // Kept in step with trail-trust.js's MULTI_DAY_MIN_KM. Duplicated (not
  // imported) so this module stays standalone for the browser globals build and
  // the Node test harness alike.
  const MULTI_DAY_MIN_KM = 25;
  const FILTER_ORDER = [
    'search', 'country', 'region', 'valley', 'risk', 'distance', 'duration', 'difficulty', 'terrain', 'water', 'heat',
    'exposure', 'access', 'collection', 'minMatch',
  ];

  function legacyCategoryState(trail, category){
    const explicit = trail && trail.verification && trail.verification.categories;
    if(explicit && !Array.isArray(explicit)) return explicit[category] || 'unknown';
    const reviewed = new Set(Array.isArray(trail && trail.verified && trail.verified.categories)
      ? trail.verified.categories : []);
    const completed = new Set(Array.isArray(trail && trail.graduation && trail.graduation.completed)
      ? trail.graduation.completed : []);
    return reviewed.has(category) || completed.has(category) ? 'verified' : 'unknown';
  }

  function fallbackTrail(trail){
    const text = `${trail && trail.desc || ''} ${trail && trail.tips || ''}`;
    let access = 'unknown';
    if(/\bdogs?\s+(?:are\s+)?not\s+(?:allowed|permitted)|\bdog\s*=\s*no\b/i.test(text)) access = 'prohibited';
    else if(/dogs?.{0,30}(?:must|stay|keep).{0,20}(?:on (?:a )?lead|leash)|leash (?:is )?required/i.test(text)) access = 'leash-required';
    const tier = root && root.DoloPawsEvidenceV1
      ? root.DoloPawsEvidenceV1.tierOf(trail)
      : trail && trail.curated === false ? 'imported' : 'route-audited';
    return {
      metrics: { distanceKm: Number.isFinite(trail && trail.distance) ? trail.distance : null },
      suitability: {
        safetyLevel: trail && trail.safetyLevel || 'unknown',
        terrainRank: Number.isFinite(trail && trail.terrainRank) ? trail.terrainRank : null,
        shadePercent: Number.isFinite(trail && trail.shadeCoverage) ? trail.shadeCoverage : null,
        heatRisk: trail && ['low', 'moderate', 'high'].includes(trail.heatRisk) ? trail.heatRisk : 'unknown',
        exposure: trail && typeof trail.exposure === 'boolean' ? trail.exposure : null,
        dogAccess: { status: access },
      },
      waypoints: (Array.isArray(trail && trail.waterSources) ? trail.waterSources : [])
        .map((point, index) => ({ id: `water-${index}`, type:'water', status: point && point.status || 'mapped' })),
      verification: {
        tier,
        categories: Object.fromEntries(
          ['route','water','heat','exposure','livestock','surfaceHazards','access']
            .map(category => [category, legacyCategoryState(trail, category)])
        ),
      },
    };
  }

  function normalizedTrail(trail){
    if(trail && trail.metrics && trail.suitability && trail.verification) return trail;
    const adapters = root && root.DoloPawsRecommendationAdaptersV1;
    return adapters && typeof adapters.normalizeTrail === 'function'
      ? adapters.normalizeTrail(trail)
      : fallbackTrail(trail || {});
  }

  function verified(parts, category){
    return parts.verification && parts.verification.categories
      && parts.verification.categories[category] === 'verified';
  }

  function matches(trail, state, options){
    state = state || {};
    const parts = normalizedTrail(trail);
    const suitability = parts.suitability || {};
    const metrics = parts.metrics || {};
    const q = String(state.search || '').trim().toLocaleLowerCase();
    const searchable = [trail.name, trail.area, trail.valley, trail.region]
      .filter(Boolean).join(' ').toLocaleLowerCase();

    if(q && !searchable.includes(q)) return false;
    if(state.country){
      const country = String(trail.country || '').toLocaleLowerCase();
      const expectedRegion = state.country === 'italy' ? 'dolomites' : 'savoy';
      const expectedCode = state.country === 'italy' ? 'it' : 'fr';
      if(trail.region !== expectedRegion && country !== state.country && country !== expectedCode) return false;
    }
    if(state.region && state.region !== 'all' && trail.region !== state.region) return false;
    if(state.valley && state.valley !== 'all' && trail.valley !== state.valley) return false;
    if(state.risk && state.risk !== 'all' && suitability.safetyLevel !== state.risk) return false;

    if(state.distance && state.distance !== 'all'){
      const d = metrics.distanceKm;
      if(!Number.isFinite(d)) return false;
      if(state.distance === 'u5'){ if(d >= 5) return false; }
      else if(state.distance === '5to10'){ if(d < 5 || d > 10) return false; }
      else if(state.distance === '10p'){ if(d < 10) return false; }
      else if(d > Number(state.distance)) return false;
    }

    // Day hikes vs multi-day itineraries. A long imported route (or a whole
    // network mapped as one line) is a multi-day trip most visitors are not
    // looking for, so 'day' hides anything past the threshold and 'multi' keeps
    // only those. Unset (or 'all') leaves the list untouched, so existing
    // callers and tests that never set `duration` see every trail as before.
    if(state.duration === 'day' || state.duration === 'multi'){
      const long = Number(metrics.distanceKm) > MULTI_DAY_MIN_KM;
      if(state.duration === 'day' ? long : !long) return false;
    }

    if(state.difficulty){
      const gain = trail && Number.isFinite(trail.elevation) ? trail.elevation
        : Number.isFinite(metrics.ascentM) ? metrics.ascentM : null;
      if(!Number.isFinite(gain) || !Number.isFinite(metrics.distanceKm)
        || !Number.isFinite(suitability.terrainRank)) return false;
      const difficulty = gain >= 400 || (suitability.terrainRank >= 2 && gain >= 250)
        ? 'Hard'
        : gain >= 180 || metrics.distanceKm >= 6 || suitability.terrainRank >= 2
          ? 'Moderate' : 'Easy';
      if(difficulty !== state.difficulty) return false;
    }

    if(state.terrain){
      if(!Number.isFinite(suitability.terrainRank)) return false;
      if(state.terrain === 'soft' && suitability.terrainRank > 0) return false;
      if(state.terrain === 'mixed' && suitability.terrainRank > 1) return false;
      if(state.terrain === 'rocky' && suitability.terrainRank > 2) return false;
    }

    if(state.water){
      // "Water on route" is a discovery aid: does the route have a water point
      // mapped at all? It is a presence test, like distance or duration, not a
      // reliability claim -- only a handful of trails carry a reviewed-water
      // record, so gating this on review would return almost nothing and mean
      // something different here than on the homepages. The reliability caveat
      // lives on the trail page ("potential water location, availability can
      // change"). Heat/exposure/access below stay reviewed-gated: those are
      // safety claims, not presence filters.
      const hasWater = Array.isArray(parts.waypoints)
        && parts.waypoints.some(point => point && point.type === 'water');
      if(!hasWater) return false;
    }

    if(state.heat === 'shade-40' || state.heat === 'shade-60'){
      // Mirrors the homepage shade filter: raw coverage, no review gate.
      const minShade = state.heat === 'shade-60' ? 60 : 40;
      if(!Number.isFinite(suitability.shadePercent) || suitability.shadePercent < minShade) return false;
    }else if(state.heat === 'shade-reviewed'){
      if(!verified(parts, 'heat') || !Number.isFinite(suitability.shadePercent)
        || suitability.shadePercent < 30) return false;
    }else if(state.heat === 'low-reviewed'){
      if(!verified(parts, 'heat') || suitability.heatRisk !== 'low') return false;
    }

    if(state.exposure === 'none-reviewed'
      && (!verified(parts, 'exposure') || suitability.exposure !== false)) return false;

    if(state.access){
      const status = suitability.dogAccess && suitability.dogAccess.status;
      if(!verified(parts, 'access')) return false;
      if(state.access === 'allowed-reviewed'
        && !['allowed', 'leash-required'].includes(status)) return false;
      if(state.access === 'leash-ok-reviewed'
        && !['allowed', 'leash-required'].includes(status)) return false;
    }

    if(state.collection && options && options.collections && options.collections[state.collection]
      && !options.collections[state.collection](trail)) return false;
    if(state.minMatch && options && typeof options.score === 'function'
      && options.score(trail) < Number(state.minMatch)) return false;
    return true;
  }

  function filter(trails, state, options){
    return (Array.isArray(trails) ? trails : []).filter(trail => matches(trail, state, options));
  }

  function labelFor(key, state){
    const labels = {
      search: `Search “${state.search}”`,
      country: state.country === 'italy' ? 'Italy' : 'France',
      region: state.region === 'dolomites' ? 'Dolomites region' : 'Savoy region',
      valley: state.valley,
      risk: `${state.risk} rating`,
      distance: state.distance === 'u5' ? 'Under 5 km'
        : state.distance === '5to10' ? '5–10 km'
        : state.distance === '10p' ? '10 km+'
        : `Up to ${state.distance} km`,
      difficulty: `${state.difficulty} route`,
      terrain: {
        soft:'Gentle surfaces only',
        mixed:'Up to mixed terrain',
        rocky:'Rocky terrain is okay',
      }[state.terrain],
      water: 'Water point listed',
      heat: state.heat === 'low-reviewed' ? 'Lower heat exposure'
        : state.heat === 'shade-40' ? 'Over 40% shade'
        : state.heat === 'shade-60' ? 'Over 60% shade'
        : 'Shade listed',
      exposure: 'No reported exposure',
      access: state.access === 'allowed-reviewed' ? 'Dogs permitted' : 'Dogs allowed, leash is okay',
      duration: 'Multi-day routes',
      collection: `${state.collection} collection`,
      minMatch: `${state.minMatch}%+ dog match`,
    };
    return labels[key] || key;
  }

  function active(state){
    state = state || {};
    return FILTER_ORDER.filter(key => {
      const value = state[key];
      // 'day' is the baseline view, not a filter the visitor added, so it never
      // shows up as a removable chip; only the 'multi' opt-in counts.
      if(key === 'duration') return value === 'multi';
      return value !== undefined && value !== null && value !== '' && value !== false && value !== 'all';
    }).map(key => ({ key, label: labelFor(key, state) }));
  }

  function without(state, key){
    // Removing the multi-day chip returns to the default day-hike view, not to
    // an unfiltered "show everything" state.
    if(key === 'duration') return { ...state, duration: 'day' };
    return { ...state, [key]: key === 'water' ? false : '' };
  }

  function safeBroadenings(trails, state, options){
    const candidates = [];
    const distance = Number(state && state.distance);
    const nextDistance = DISTANCES.find(value => value > distance);
    if(nextDistance){
      candidates.push({
        key:'distance',
        label:`Widen distance to ${nextDistance} km`,
        state:{ ...state, distance:String(nextDistance), page:1 },
      });
    }
    if(state && state.terrain === 'soft'){
      candidates.push({
        key:'terrain',
        label:'Allow mixed terrain',
        state:{ ...state, terrain:'mixed', page:1 },
      });
    }else if(state && state.terrain === 'mixed'){
      candidates.push({
        key:'terrain',
        label:'Allow known rocky terrain',
        state:{ ...state, terrain:'rocky', page:1 },
      });
    }
    return candidates.map(candidate => ({
      ...candidate,
      count: filter(trails, candidate.state, options).length,
    })).filter(candidate => candidate.count > 0);
  }

  function diagnoseZero(trails, state, options){
    const restrictive = active(state).map(entry => {
      const relaxed = without(state, entry.key);
      return { ...entry, countWithout: filter(trails, relaxed, options).length, state: relaxed };
    }).filter(entry => entry.countWithout > 0)
      .sort((a, b) => b.countWithout - a.countWithout);
    return { restrictive, broadenings: safeBroadenings(trails, state, options) };
  }

  return Object.freeze({
    DISTANCES, MULTI_DAY_MIN_KM, normalizedTrail, matches, filter, active, diagnoseZero, safeBroadenings,
  });
});
