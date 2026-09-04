(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsRecommendationAdaptersV1 = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  const AGE_BAND_MID = {
    u1: 0.5, '1-2': 1.5, '3-4': 3.5, '5-6': 5.5,
    '7-8': 7.5, '9-10': 9.5, '11-12': 11.5, '13plus': 14,
  };
  const WEIGHT_BAND_MID = {
    u5: 4, '5-10': 7.5, '10-15': 12.5, '15-20': 17.5,
    '20-30': 25, '30-40': 35, '40-55': 47.5, '55plus': 60,
  };
  const REVIEW_CATEGORIES = [
    'route', 'water', 'heat', 'exposure', 'livestock',
    'surfaceHazards', 'access',
  ];

  function ageYears(profile, asOfDate){
    if(profile && profile.dob){
      const dob = new Date(`${profile.dob}T00:00:00Z`);
      const now = asOfDate ? new Date(`${asOfDate}T00:00:00Z`) : new Date();
      if(!Number.isNaN(dob.getTime()) && !Number.isNaN(now.getTime())){
        return Math.max(0, (now.getTime() - dob.getTime()) / 31557600000);
      }
    }
    if(profile && AGE_BAND_MID[profile.ageBand] !== undefined) return AGE_BAND_MID[profile.ageBand];
    return profile && Number.isFinite(profile.age) ? profile.age : null;
  }

  function weightKg(profile){
    if(profile && WEIGHT_BAND_MID[profile.weightBand] !== undefined){
      return WEIGHT_BAND_MID[profile.weightBand];
    }
    return profile && Number.isFinite(profile.weight) ? profile.weight : null;
  }

  function conditions(profile){
    if(profile && Array.isArray(profile.conditions)) return profile.conditions.slice();
    return [
      profile && profile.jointIssues ? 'joints' : null,
      profile && profile.heatIssues ? 'heat' : null,
    ].filter(Boolean);
  }

  function traits(profile){
    const derived = root && typeof root.breedTraits === 'function'
      ? root.breedTraits(profile && profile.breed || '') : {};
    return {
      heatSensitive: !!derived.heatSensitive,
      shortLegged: !!derived.shortLegged,
      giant: !!derived.giant,
      backRisk: !!derived.backRisk,
    };
  }

  const BEHAVIOUR_SCALES = {
    recall: ['reliable', 'variable', 'unreliable'],
    reactivity: ['none', 'mild', 'strong'],
    preyDrive: ['low', 'moderate', 'high'],
    livestockComfort: ['confident', 'cautious', 'reactive'],
    trafficComfort: ['confident', 'cautious', 'reactive'],
    crowdComfort: ['confident', 'cautious', 'reactive'],
    heatTolerance: ['robust', 'average', 'low'],
  };

  // Only recognised answers are forwarded. An unrecognised or legacy value is
  // dropped rather than coerced, so a stale client cannot silently downgrade a
  // dog to the easiest end of a scale.
  function behaviour(profile){
    const source = profile && profile.behaviour;
    const normalized = {};
    if(source && typeof source === 'object'){
      for(const [key, scale] of Object.entries(BEHAVIOUR_SCALES)){
        if(scale.includes(source[key])) normalized[key] = source[key];
      }
      const minutes = Number(source.preferredDurationMin);
      if(Number.isFinite(minutes) && minutes > 0 && minutes <= 1440){
        normalized.preferredDurationMin = Math.round(minutes);
      }
    }
    return normalized;
  }

  function normalizeDog(profile, options){
    profile = profile || {};
    return {
      ageYears: ageYears(profile, options && options.asOfDate),
      weightKg: weightKg(profile),
      fitness: ['low', 'moderate', 'high'].includes(profile.fitness)
        ? profile.fitness : 'unknown',
      conditions: conditions(profile),
      traits: traits(profile),
      behaviour: behaviour(profile),
    };
  }

  function legacyDogAccess(trail){
    const text = `${trail && trail.desc || ''} ${trail && trail.tips || ''}`;
    if(/\bdogs?\s+(?:are\s+)?not\s+(?:allowed|permitted)|\bdog\s*=\s*no\b/i.test(text)){
      return { status: 'prohibited', notes: 'The trail record states that dogs are prohibited.' };
    }
    if(/dogs?.{0,30}(?:must|stay|keep).{0,20}(?:on (?:a )?lead|leash)|leash (?:is )?required/i.test(text)){
      return { status: 'leash-required', notes: 'The trail record states that a leash is required.' };
    }
    return { status: 'unknown', notes: null };
  }

  function verificationCategories(trail, suitability){
    if(trail && trail.verification && trail.verification.categories
      && !Array.isArray(trail.verification.categories)){
      return trail.verification.categories;
    }
    const verified = new Set(
      Array.isArray(trail && trail.verified && trail.verified.categories)
        ? trail.verified.categories : []
    );
    const completed = new Set(
      Array.isArray(trail && trail.graduation && trail.graduation.completed)
        ? trail.graduation.completed : []
    );
    const known = {
      route: Array.isArray(trail && trail.path) && trail.path.length >= 2,
      water: Array.isArray(trail && trail.waterSources),
      heat: suitability.heatRisk !== 'unknown' && suitability.shadePercent !== null,
      exposure: suitability.exposure !== null,
      livestock: /livestock|cattle|herd|pasture|patou|guardian/i.test(
        `${trail && trail.desc || ''} ${trail && trail.tips || ''}`
      ),
      surfaceHazards: Array.isArray(trail && trail.surfaceHazards),
      access: suitability.dogAccess.status !== 'unknown',
    };
    return Object.fromEntries(REVIEW_CATEGORIES.map(category => [
      category,
      verified.has(category) || completed.has(category)
        ? 'verified' : known[category] ? 'unreviewed' : 'unknown',
    ]));
  }

  function normalizeTrail(trail){
    if(trail && trail.metrics && trail.suitability && trail.verification) return trail;
    trail = trail || {};
    const suitability = {
      safetyLevel: ['low-risk', 'moderate', 'caution'].includes(trail.safetyLevel)
        ? trail.safetyLevel : 'unknown',
      terrainRank: Number.isFinite(trail.terrainRank) ? trail.terrainRank : null,
      shadePercent: Number.isFinite(trail.shadeCoverage) ? trail.shadeCoverage : null,
      heatRisk: ['low', 'moderate', 'high'].includes(trail.heatRisk)
        ? trail.heatRisk : 'unknown',
      exposure: typeof trail.exposure === 'boolean' ? trail.exposure : null,
      surfaceHazards: Array.isArray(trail.surfaceHazards) ? trail.surfaceHazards : [],
      dogAccess: legacyDogAccess(trail),
      // Legacy presentation records carry no reviewed behaviour attributes.
      // Declaring them unknown keeps the engine's "say nothing without
      // evidence" branch, rather than reading absence as safety.
      livestockPresence: 'unknown',
      wildlifePresence: 'unknown',
      sightlines: 'unknown',
      roadProximity: 'unknown',
      crowding: 'unknown',
    };
    const categories = verificationCategories(trail, suitability);
    const tier = root && root.DoloPawsEvidenceV1
      ? root.DoloPawsEvidenceV1.tierOf(trail)
      : trail.curated === false ? 'imported' : 'route-audited';
    return {
      id: trail.id || null,
      recordVersion: trail.recordVersion || 1,
      metrics: {
        distanceKm: Number.isFinite(trail.distance) ? trail.distance : null,
        ascentM: Number.isFinite(trail.elevation) ? trail.elevation : null,
        descentM: Number.isFinite(trail.descent) ? trail.descent : null,
        durationMinutes: Number.isFinite(trail.hours) ? Math.round(trail.hours * 60) : null,
      },
      suitability,
      waypoints: (Array.isArray(trail.waterSources) ? trail.waterSources : []).map((water, index) => ({
        id: `${trail.id || 'trail'}-water-${index + 1}`,
        type: 'water',
        status: categories.water === 'verified' ? 'reviewed' : 'mapped',
      })),
      segments: Array.isArray(trail.segments) ? trail.segments : [],
      verification: { tier, categories },
    };
  }

  function subjectProfile(subject){
    if(subject && subject._profile) return subject._profile;
    if(subject && (subject.fitness || subject.conditions || subject.dob || subject.ageBand)){
      return subject;
    }
    const terrain = Number(subject && subject.terrain);
    const distance = Number(subject && subject.distance);
    const fitness = terrain >= 2 || distance > 10 ? 'high'
      : terrain <= 0 && distance <= 5 ? 'low' : 'moderate';
    return {
      fitness,
      conditions: subject && subject.heatSensitive ? ['heat'] : [],
    };
  }

  function effectiveLimits(subject){
    if(!subject || (subject.terrain === undefined && subject.distance === undefined)) return null;
    const terrain = Number(subject.terrain);
    const distance = Number(subject.distance);
    return {
      terrainRank: Number.isFinite(terrain) ? Math.max(0, Math.min(2, terrain)) : undefined,
      distanceKm: Number.isFinite(distance) ? Math.max(2, Math.min(18, distance)) : undefined,
      heatSensitive: typeof subject.heatSensitive === 'boolean'
        ? subject.heatSensitive : undefined,
    };
  }

  function recommendLegacyTrail(trail, subject, currentConditions, options){
    const engine = root && root.DoloPawsRecommendationV1;
    if(!engine || typeof engine.calculateRecommendation !== 'function'){
      throw new Error('The canonical recommendation engine is unavailable.');
    }
    return engine.calculateRecommendation({
      dog: normalizeDog(subjectProfile(subject), options),
      trail: normalizeTrail(trail),
      currentConditions: currentConditions || { status: 'not-provided' },
      effectiveLimits: effectiveLimits(subject),
    });
  }

  return Object.freeze({
    AGE_BAND_MID,
    WEIGHT_BAND_MID,
    ageYears,
    weightKg,
    conditions,
    behaviour,
    normalizeDog,
    normalizeTrail,
    effectiveLimits,
    recommendLegacyTrail,
  });
});
