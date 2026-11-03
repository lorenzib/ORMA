(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsEvidenceV1 = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if(i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  const VERSION = '1.0.0';
  // Seven here, but only six of them can ever be reviewed through
  // `verified.categories`. VERIFICATION.md names those six -- water, heat,
  // exposure, livestock, surfaceHazards, access -- as the safety checks a
  // source review covers, and puts `route` with photo, routeNumbers, mapPoints
  // and elevation in `graduation`, which is a different record answering a
  // different question.
  //
  // So canonicalReviewState(trail, 'route') reads a list that by contract never
  // contains 'route', and a verified trail reports its route evidence as
  // unknown. That reads like a bug and is not one: it is this module modelling
  // route as a review category when the standard treats it as a graduation
  // check. Nothing ships that distinction today -- assessTrail and the
  // freshness contract below have no caller outside evidence-contract.test.js;
  // the product uses tierOf, tierLabel and dateText. Wiring the per-category
  // contract to a reader-facing surface means settling that difference first.
  const CATEGORIES = Object.freeze([
    'route', 'water', 'heat', 'exposure', 'livestock',
    'surfaceHazards', 'access',
  ]);
  // The six a source review can establish, as VERIFICATION.md defines them.
  const REVIEWABLE_CATEGORIES = Object.freeze(
    CATEGORIES.filter(category => category !== 'route'));
  const TIERS = Object.freeze([
    'imported', 'mapped', 'route-audited', 'field-verified',
  ]);
  // Visitor-facing, so in the trail page's words (trail-trust.js tierLabel):
  // a card used the tier's internal name where the same trail's page said
  // "Verified by ORMA". The tier ids stay as they are.
  const TIER_LABELS = Object.freeze({
    imported: 'Imported map data',
    mapped: 'Mapped route',
    'route-audited': 'Verified by ORMA',
    'field-verified': 'Verified and walked by ORMA',
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
    // A curated listing has been prepared and reviewed by ORMA, but curation
    // alone is not field verification. It sits at `mapped` (route reviewed) and
    // only earns `route-audited` once its evidence dossier graduates.
    //
    // #516 established this and #589 held it back, because it shipped while no
    // trail had graduated and the catalogue would have advertised zero verified
    // trails. Four have now graduated -- tre-cime, lago-braies,
    // cinque-torri-assisted and osm-14381570 -- so the seal means something
    // when it appears, and the other 24 read "Reviewed by ORMA" until their own
    // dossiers graduate. Four of 162 is the honest count, not a failure of the
    // catalogue to describe itself.
    return 'mapped';
  }

  function tierLabel(tierOrTrail){
    const tier = typeof tierOrTrail === 'string' ? tierOrTrail : tierOf(tierOrTrail);
    switch(tier){
      case 'mapped': return tx('Mapped route');
      case 'route-audited': return tx('Verified by ORMA');
      case 'field-verified': return tx('Verified and walked by ORMA');
      default: return tx('Imported map data');
    }
  }

  // The shown label of a source state or freshness state (SOURCE_LABELS,
  // FRESHNESS_LABELS), in the reader's language.
  function sourceLabel(state){
    switch(state){
      case 'mapped': return tx('Mapped data');
      case 'source-listed': return tx('Source listed, not reviewed');
      case 'source-reviewed': return tx('ORMA source-reviewed');
      case 'field-checked': return tx('ORMA field-checked');
      case 'unknown': return tx('Evidence unknown');
      default: return SOURCE_LABELS[state];
    }
  }
  function freshnessLabel(state){
    switch(state){
      case 'current': return tx('Current for its review window');
      case 'aging': return tx('Review becoming old');
      case 'stale': return tx('Review stale');
      case 'unknown': return tx('Freshness unknown');
      default: return FRESHNESS_LABELS[state];
    }
  }

  function validDate(value){
    if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateText(value){
    const date = validDate(value);
    if(!date) return tx('date unknown');
    const d = date.getUTCDate();
    const y = date.getUTCFullYear();
    switch(date.getUTCMonth()){
      case 0: return tx('{d} Jan {y}', { d, y });
      case 1: return tx('{d} Feb {y}', { d, y });
      case 2: return tx('{d} Mar {y}', { d, y });
      case 3: return tx('{d} Apr {y}', { d, y });
      case 4: return tx('{d} May {y}', { d, y });
      case 5: return tx('{d} Jun {y}', { d, y });
      case 6: return tx('{d} Jul {y}', { d, y });
      case 7: return tx('{d} Aug {y}', { d, y });
      case 8: return tx('{d} Sep {y}', { d, y });
      case 9: return tx('{d} Oct {y}', { d, y });
      case 10: return tx('{d} Nov {y}', { d, y });
      default: return tx('{d} Dec {y}', { d, y });
    }
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
      sourceLabel: sourceLabel(source),
      freshnessState: freshness,
      freshnessLabel: freshnessLabel(freshness),
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
    REVIEWABLE_CATEGORIES,
  });
});
