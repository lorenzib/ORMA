(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsEvidenceV1 = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const VERSION = '1.0.0';
  const CATEGORIES = Object.freeze([
    'route', 'water', 'heat', 'exposure', 'livestock',
    'surfaceHazards', 'access',
  ]);
  const TIERS = Object.freeze([
    'imported', 'mapped', 'route-audited', 'field-verified',
  ]);
  const TIER_LABELS = Object.freeze({
    imported: 'Imported map data',
    mapped: 'Mapped route',
    'route-audited': 'ORMA route-audited',
    'field-verified': 'ORMA field-verified',
  });
  const SOURCE_LABELS = Object.freeze({
    unknown: 'Evidence unknown',
    mapped: 'Mapped data',
    'source-listed': 'Source listed, not reviewed',
    'source-reviewed': 'ORMA source-reviewed',
    'field-checked': 'ORMA field-checked',
  });
  const FRESHNESS_LABELS = Object.freeze({
    current: 'Current for its review window',
    aging: 'Review becoming old',
    stale: 'Review stale',
    unknown: 'Freshness unknown',
  });
  const MAX_AGE_DAYS = Object.freeze({
    route: 365,
    water: 90,
    heat: 180,
    exposure: 365,
    livestock: 90,
    surfaceHazards: 180,
    access: 90,
  });

  function validRoute(trail){
    if(!trail) return false;
    if(trail.geometry && Array.isArray(trail.geometry.coordinates)){
      return trail.geometry.type === 'MultiLineString'
        ? trail.geometry.coordinates.some(line => Array.isArray(line) && line.length >= 2)
        : trail.geometry.coordinates.length >= 2;
    }
    return Array.isArray(trail.path) && trail.path.length >= 2;
  }

  function legacyGraduationVerified(trail){
    const graduation = trail && trail.graduation;
    if(!graduation || graduation.status !== 'verified') return false;
    const required = Array.isArray(graduation.required) ? graduation.required : [];
    const completed = new Set(Array.isArray(graduation.completed) ? graduation.completed : []);
    return required.length > 0 && required.every(entry => completed.has(entry));
  }

  function tierOf(trail){
    if(!trail || !validRoute(trail)) return 'imported';
    const canonical = trail.verification && trail.verification.tier;
    if(TIERS.includes(canonical)) return canonical;
    if(trail.tier === 'dolopaws-walked' || trail.walked === true) return 'field-verified';
    if(trail.tier === 'route-audited' || legacyGraduationVerified(trail)) return 'route-audited';
    if(trail.tier === 'under-review' || trail.curated === false){
      return trail.routeAudit ? 'mapped' : 'imported';
    }
    return 'route-audited';
  }

  function tierLabel(tierOrTrail){
    const tier = typeof tierOrTrail === 'string' ? tierOrTrail : tierOf(tierOrTrail);
    return TIER_LABELS[tier] || TIER_LABELS.imported;
  }

  function validDate(value){
    if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateText(value){
    const date = validDate(value);
    if(!date) return 'date unknown';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  function sourceRecords(trail, category){
    const canonical = Array.isArray(trail && trail.sources) ? trail.sources : [];
    if(canonical.length){
      return canonical.filter(source =>
        Array.isArray(source.categories) && source.categories.includes(category));
    }
    const legacy = Array.isArray(trail && trail.sourceLinks) ? trail.sourceLinks : [];
    return legacy.filter(source =>
      !Array.isArray(source.categories) || source.categories.includes(category));
  }

  function canonicalReviewState(trail, category){
    const categories = trail && trail.verification && trail.verification.categories;
    if(categories && !Array.isArray(categories)) return categories[category] || 'unknown';
    const legacy = trail && trail.verified && trail.verified.categories;
    if(Array.isArray(legacy)) return legacy.includes(category) ? 'verified' : 'unreviewed';
    return trail && trail.curated === false ? 'unknown' : 'unreviewed';
  }

  function sourceState(trail, category){
    const reviewState = canonicalReviewState(trail, category);
    const tier = tierOf(trail);
    const sources = sourceRecords(trail, category);
    const fieldSource = sources.some(source => source.kind === 'field-review');
    const mappedSource = sources.some(source =>
      source.kind === 'osm' || /openstreetmap|waymarked/i.test(`${source.provider || ''} ${source.label || ''}`));

    if(reviewState === 'verified'){
      return tier === 'field-verified' && fieldSource
        ? 'field-checked'
        : 'source-reviewed';
    }
    if(reviewState === 'unreviewed'){
      if(mappedSource || (category === 'route' && (tier === 'imported' || tier === 'mapped'))) return 'mapped';
      return sources.length ? 'source-listed' : 'unknown';
    }
    if(category === 'route' && validRoute(trail)) return 'mapped';
    return 'unknown';
  }

  function latestObservedDate(trail, category){
    const dates = sourceRecords(trail, category)
      .map(source => source.observedAt)
      .filter(value => validDate(value));
    if(dates.length) return dates.sort().at(-1);

    const freshness = trail && trail.freshness;
    const fallback = category === 'route'
      ? freshness && freshness.geometryAt
      : category === 'access'
        ? freshness && freshness.accessAt
        : freshness && freshness.safetyAt;
    if(validDate(fallback)) return fallback;

    const legacy = trail && (trail.reviewedAt || (trail.verified && trail.verified.date));
    return canonicalReviewState(trail, category) === 'verified' && validDate(legacy)
      ? legacy
      : null;
  }

  function freshnessState(category, observedAt, asOfDate){
    const observed = validDate(observedAt);
    const asOf = validDate(asOfDate);
    if(!observed || !asOf || observed > asOf) return 'unknown';
    const ageDays = Math.floor((asOf - observed) / 86400000);
    const limit = MAX_AGE_DAYS[category];
    if(ageDays > limit) return 'stale';
    if(ageDays > Math.floor(limit * 0.75)) return 'aging';
    return 'current';
  }

  function categoryEvidence(trail, category, options){
    if(!CATEGORIES.includes(category)) throw new Error(`Unsupported evidence category: ${category}`);
    const observedAt = latestObservedDate(trail, category);
    const source = sourceState(trail, category);
    const freshness = freshnessState(category, observedAt, options && options.asOfDate);
    return {
      category,
      sourceState: source,
      sourceLabel: SOURCE_LABELS[source],
      freshnessState: freshness,
      freshnessLabel: FRESHNESS_LABELS[freshness],
      observedAt,
      observedLabel: dateText(observedAt),
    };
  }

  function communityObservation(report){
    const status = ['unconfirmed', 'confirmed', 'disputed', 'resolved'].includes(report && report.status)
      ? report.status : 'unconfirmed';
    return {
      id: report && report.id ? String(report.id) : null,
      type: report && report.type ? String(report.type) : 'other',
      status,
      label: `Community report · ${status}`,
      observedAt: validDate(report && report.observedAt) ? report.observedAt : null,
    };
  }

  function assessTrail(trail, options){
    options = options || {};
    const tier = tierOf(trail);
    const categories = Object.fromEntries(CATEGORIES.map(category => [
      category,
      categoryEvidence(trail, category, options),
    ]));
    return {
      evidenceVersion: VERSION,
      tier,
      tierLabel: tierLabel(tier),
      categories,
      communityObservations: (Array.isArray(options.communityReports)
        ? options.communityReports : []).map(communityObservation),
    };
  }

  return Object.freeze({
    VERSION,
    CATEGORIES,
    TIERS,
    TIER_LABELS,
    SOURCE_LABELS,
    FRESHNESS_LABELS,
    MAX_AGE_DAYS,
    tierOf,
    tierLabel,
    dateText,
    sourceState,
    freshnessState,
    categoryEvidence,
    communityObservation,
    assessTrail,
  });
});
