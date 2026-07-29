(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsComparisonModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  const CATEGORY_LABELS = {
    'strong-option':'Strong option',
    'possible-with-cautions':'Possible with cautions',
    'not-recommended':'Not recommended',
  };
  const TERRAIN = {
    0:'Gentle or paved',
    1:'Mixed natural terrain',
    2:'Rocky or technical',
    3:'Highly technical',
  };
  const ACCESS = {
    allowed:'Dogs allowed',
    'leash-required':'Dogs allowed on leash',
    'seasonal-restrictions':'Seasonal restrictions',
    prohibited:'Dogs prohibited',
  };
  const TIERS = {
    imported:'Imported map data',
    mapped:'Mapped by DoloPaws',
    'route-audited':'DoloPaws route-audited',
    'field-verified':'DoloPaws field-verified',
  };

  function cell(text, kind, detail){
    return { text, kind:kind || 'known', detail:detail || null };
  }
  function unknown(label){
    return cell(`Unknown — ${label} not reviewed`, 'unknown');
  }
  function categoryVerified(parts, category){
    return parts.verification && parts.verification.categories
      && parts.verification.categories[category] === 'verified';
  }
  function formatNumber(value, suffix){
    return Number.isFinite(value) ? `${Math.round(value * 10) / 10}${suffix}` : null;
  }
  function formatDuration(value){
    if(value === null || value === undefined || value === '') return null;
    const text = String(value).trim();
    return /\b(?:h|hr|hour|hours|min|minute|minutes)\b/i.test(text)
      ? text : `${text} h`;
  }

  function build(trail, options){
    options = options || {};
    const normalizeTrail = options.normalizeTrail
      || (root.DoloPawsRecommendationAdaptersV1 && root.DoloPawsRecommendationAdaptersV1.normalizeTrail);
    const parts = normalizeTrail ? normalizeTrail(trail) : trail;
    const recommendation = options.recommendation || (
      root.DoloPawsScoring && typeof root.DoloPawsScoring.recommendTrail === 'function'
        ? root.DoloPawsScoring.recommendTrail(trail, options.subject || {})
        : null
    );
    const suitability = parts.suitability || {};
    const metrics = parts.metrics || {};
    const tier = parts.verification && parts.verification.tier || 'imported';
    const terrainKnown = Number.isFinite(suitability.terrainRank);
    const reasons = recommendation
      ? [].concat(recommendation.hardStops || [], recommendation.cautions || [])
        .concat((recommendation.hardStops || []).length || (recommendation.cautions || []).length
          ? [] : recommendation.positiveReasons || [])
        .slice(0, 3).map(item => item.message)
      : [];
    const unknownCount = recommendation && Array.isArray(recommendation.unknowns)
      ? recommendation.unknowns.length : 0;
    const reviewedWater = Array.isArray(parts.waypoints)
      ? parts.waypoints.filter(point => point.type === 'water' && point.status === 'reviewed').length
      : 0;
    const hazards = Array.isArray(suitability.surfaceHazards) ? suitability.surfaceHazards : null;
    const access = suitability.dogAccess && suitability.dogAccess.status;

    return {
      id:trail.id,
      name:trail.name,
      area:trail.area || trail.valley || '',
      cells:{
        match: recommendation
          ? cell(`${CATEGORY_LABELS[recommendation.category] || recommendation.category} · ${recommendation.score}%`, recommendation.category === 'not-recommended' ? 'caution' : 'known',
            `${recommendation.confidence} confidence · scoring ${recommendation.scoringVersion}`)
          : unknown('dog match'),
        reasons: reasons.length
          ? cell(reasons.join(' '), (recommendation.hardStops || []).length || (recommendation.cautions || []).length ? 'caution' : 'known',
            unknownCount ? `${unknownCount} unknown item${unknownCount === 1 ? '' : 's'} also affect confidence` : null)
          : unknown('recommendation reasons'),
        distance: formatNumber(metrics.distanceKm, ' km')
          ? cell(formatNumber(metrics.distanceKm, ' km')) : unknown('distance'),
        elevation: formatNumber(metrics.ascentM, ' m ascent')
          ? cell(formatNumber(metrics.ascentM, ' m ascent')) : unknown('elevation'),
        duration: formatDuration(trail.hours)
          ? cell(formatDuration(trail.hours)) : unknown('duration'),
        terrain: terrainKnown
          ? cell(TERRAIN[suitability.terrainRank] || `Terrain level ${suitability.terrainRank}`,
            categoryVerified(parts, 'surfaceHazards') ? 'known' : 'mapped',
            categoryVerified(parts, 'surfaceHazards') ? 'Surface evidence reviewed' : 'Mapped terrain; surface hazards not reviewed')
          : unknown('terrain'),
        exposure: categoryVerified(parts, 'exposure')
          ? cell(suitability.exposure ? 'Exposed sections recorded' : 'No exposure recorded in reviewed evidence',
            suitability.exposure ? 'caution' : 'known')
          : unknown('exposure'),
        shade: categoryVerified(parts, 'heat') && Number.isFinite(suitability.shadePercent)
          ? cell(`${Math.round(suitability.shadePercent)}% reviewed shade`,
            suitability.shadePercent < 20 ? 'caution' : 'known')
          : unknown('shade'),
        heat: categoryVerified(parts, 'heat') && ['low','moderate','high'].includes(suitability.heatRisk)
          ? cell(`${suitability.heatRisk[0].toUpperCase()}${suitability.heatRisk.slice(1)} baseline heat risk`,
            suitability.heatRisk === 'high' ? 'caution' : 'known')
          : unknown('heat'),
        water: categoryVerified(parts, 'water')
          ? cell(reviewedWater
            ? `${reviewedWater} reviewed water point${reviewedWater === 1 ? '' : 's'}`
            : 'No usable water point confirmed — carry a full supply',
          reviewedWater ? 'known' : 'caution')
          : unknown('water'),
        hazards: categoryVerified(parts, 'surfaceHazards')
          ? cell(hazards && hazards.length ? hazards.join(' · ') : 'No material surface hazards in reviewed evidence',
            hazards && hazards.length ? 'caution' : 'known')
          : unknown('surface hazards'),
        restrictions: categoryVerified(parts, 'access') && ACCESS[access]
          ? cell(ACCESS[access], ['prohibited','seasonal-restrictions'].includes(access) ? 'caution' : 'known')
          : unknown('dog-access rules'),
        verification: cell(TIERS[tier] || tier, ['imported','mapped'].includes(tier) ? 'mapped' : 'known'),
      },
    };
  }

  return Object.freeze({ CATEGORY_LABELS, build, cell, unknown });
});
