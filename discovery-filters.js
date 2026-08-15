(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsDiscoveryFilters = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  const DISTANCES = [3, 5, 6, 10, 20];
  const FILTER_ORDER = [
    'search', 'region', 'risk', 'distance', 'difficulty', 'terrain', 'water', 'heat',
    'exposure', 'access', 'verification', 'collection', 'minMatch',
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
    if(state.region && state.region !== 'all' && trail.region !== state.region) return false;
    if(state.risk && state.risk !== 'all' && suitability.safetyLevel !== state.risk) return false;

    if(state.distance && state.distance !== 'all'){
      if(!Number.isFinite(metrics.distanceKm) || metrics.distanceKm > Number(state.distance)) return false;
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
      const hasWater = Array.isArray(parts.waypoints)
        && parts.waypoints.some(point => point && point.type === 'water');
      if(!hasWater || !verified(parts, 'water')) return false;
    }

    if(state.heat === 'shade-reviewed'){
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

    if(state.verification){
      const tier = parts.verification && parts.verification.tier;
      if(state.verification === 'route-audited'
        && !['route-audited', 'field-verified'].includes(tier)) return false;
      if(state.verification === 'field-verified' && tier !== 'field-verified') return false;
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
      region: state.region === 'dolomites' ? 'Dolomites region' : 'Savoy region',
      risk: `${state.risk} rating`,
      distance: `Up to ${state.distance} km`,
      difficulty: `${state.difficulty} route`,
      terrain: {
        soft:'Gentle surfaces only',
        mixed:'Up to mixed terrain',
        rocky:'Rocky terrain is okay',
      }[state.terrain],
      water: 'Water point listed',
      heat: state.heat === 'low-reviewed' ? 'Lower heat exposure' : 'Shade listed',
      exposure: 'No reported exposure',
      access: state.access === 'allowed-reviewed' ? 'Dogs permitted' : 'Dogs allowed, leash is okay',
      verification: state.verification === 'field-verified' ? 'Walked by DoloPaws' : 'Reviewed by DoloPaws',
      collection: `${state.collection} collection`,
      minMatch: `${state.minMatch}%+ dog match`,
    };
    return labels[key] || key;
  }

  function active(state){
    state = state || {};
    return FILTER_ORDER.filter(key => {
      const value = state[key];
      return value !== undefined && value !== null && value !== '' && value !== false && value !== 'all';
    }).map(key => ({ key, label: labelFor(key, state) }));
  }

  function without(state, key){
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
    if(state && state.verification === 'field-verified'){
      candidates.push({
        key:'verification',
        label:'Include DoloPaws-reviewed trails',
        state:{ ...state, verification:'route-audited', page:1 },
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
    DISTANCES, normalizedTrail, matches, filter, active, diagnoseZero, safeBroadenings,
  });
});
