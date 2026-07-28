(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsRecommendationV1 = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const VERSION = '1.1.0';
  const FITNESS = {
    low: { terrain: 0, distanceKm: 5, ascentM: 250 },
    moderate: { terrain: 1, distanceKm: 10, ascentM: 600 },
    high: { terrain: 2, distanceKm: 18, ascentM: 1200 },
  };
  const REVIEW_CATEGORIES = [
    'route', 'water', 'heat', 'exposure', 'livestock',
    'surfaceHazards', 'access',
  ];
  const CRITICAL_CATEGORIES = new Set([
    'route', 'exposure', 'surfaceHazards', 'access',
  ]);

  function item(code, message){
    return { code, message };
  }

  function unique(items){
    const seen = new Set();
    return items.filter(entry => {
      if(seen.has(entry.code)) return false;
      seen.add(entry.code);
      return true;
    });
  }

  function numberOrNull(value){
    return Number.isFinite(value) ? value : null;
  }

  function deriveDog(dog, unknowns){
    dog = dog || {};
    const fitnessKnown = Object.prototype.hasOwnProperty.call(FITNESS, dog.fitness);
    const base = FITNESS[fitnessKnown ? dog.fitness : 'moderate'];
    if(!fitnessKnown){
      unknowns.push(item('dog.fitness.unknown',
        'Fitness is missing, so moderate fitness is used as a neutral planning default.'));
    }

    const age = numberOrNull(dog.ageYears);
    const weight = numberOrNull(dog.weightKg);
    if(age === null) unknowns.push(item('dog.age.unknown', 'Age is missing, so life-stage adjustments are not applied.'));
    if(weight === null) unknowns.push(item('dog.weight.unknown', 'Weight is missing, so size adjustments are not applied.'));

    const conditions = new Set(Array.isArray(dog.conditions) ? dog.conditions : []);
    const traits = dog.traits || {};
    const puppy = age !== null && age < 1;
    const senior = age !== null && age >= 8;
    const verySenior = age !== null && age >= 11;
    const orthopedic = conditions.has('joints') || conditions.has('back')
      || conditions.has('recovering') || traits.backRisk === true;
    const giant = traits.giant === true || (weight !== null && weight >= 45);
    const toy = weight !== null && weight < 5;
    const heatSensitive = traits.heatSensitive === true || conditions.has('heat')
      || conditions.has('cardiac') || conditions.has('overweight');
    const fragile = orthopedic || senior;

    let terrain = base.terrain;
    let distanceKm = base.distanceKm;
    let ascentM = base.ascentM;

    if(puppy){
      terrain -= 1;
      distanceKm *= 0.5;
      ascentM *= 0.5;
    }else if(verySenior){
      terrain -= 1;
      distanceKm *= 0.5;
      ascentM *= 0.6;
    }else if(senior){
      terrain -= 1;
      distanceKm *= 0.75;
      ascentM *= 0.7;
    }
    if(orthopedic){
      terrain -= 1;
      distanceKm *= 0.75;
      ascentM *= 0.6;
    }
    if(conditions.has('cardiac')){
      distanceKm *= 0.6;
      ascentM *= 0.6;
    }
    if(conditions.has('overweight')){
      distanceKm *= 0.75;
      ascentM *= 0.75;
    }
    if(toy) distanceKm *= 0.8;
    if((traits.shortLegged === true || giant) && terrain > 1) terrain = 1;

    return {
      terrain: Math.max(0, terrain),
      distanceKm: Math.max(2, Math.round(distanceKm * 10) / 10),
      ascentM: Math.max(100, Math.round(ascentM)),
      heatSensitive,
      fragile,
      giant,
      impairedVision: conditions.has('vision'),
      completeness: [fitnessKnown, age !== null, weight !== null].filter(Boolean).length,
    };
  }

  function trailParts(trail){
    trail = trail || {};
    return {
      metrics: trail.metrics || {},
      suitability: trail.suitability || {},
      waypoints: Array.isArray(trail.waypoints) ? trail.waypoints : [],
      verification: trail.verification || {},
    };
  }

  function calculateRecommendation(input){
    input = input || {};
    const positives = [];
    const cautions = [];
    const unknowns = [];
    const hardStops = [];
    const dog = deriveDog(input.dog, unknowns);
    const limitOverride = input.effectiveLimits || {};
    if(Number.isFinite(limitOverride.terrainRank)){
      dog.terrain = Math.max(0, Math.min(2, limitOverride.terrainRank));
    }
    if(Number.isFinite(limitOverride.distanceKm)){
      dog.distanceKm = Math.max(2, Math.min(18, limitOverride.distanceKm));
    }
    if(Number.isFinite(limitOverride.ascentM)){
      dog.ascentM = Math.max(100, Math.min(1200, limitOverride.ascentM));
    }
    if(typeof limitOverride.heatSensitive === 'boolean'){
      dog.heatSensitive = limitOverride.heatSensitive;
    }
    const parts = trailParts(input.trail);
    const metrics = parts.metrics;
    const suitability = parts.suitability;
    const access = suitability.dogAccess || {};
    const categories = parts.verification.categories || {};
    const conditions = input.currentConditions || { status: 'not-provided' };
    let score = 100;

    const terrain = numberOrNull(suitability.terrainRank);
    if(terrain === null){
      unknowns.push(item('trail.terrain.unknown', 'Terrain difficulty is unknown.'));
    }else if(terrain > dog.terrain){
      const penalty = (terrain - dog.terrain) * 30;
      score -= penalty;
      cautions.push(item('trail.terrain.above-tolerance',
        `Terrain is above this dog's effective tolerance (${terrain} versus ${dog.terrain}).`));
    }else{
      positives.push(item('trail.terrain.within-tolerance',
        'Terrain is within this dog’s effective tolerance.'));
    }

    const distance = numberOrNull(metrics.distanceKm);
    if(distance === null){
      unknowns.push(item('trail.distance.unknown', 'Route distance is unknown.'));
    }else if(distance > dog.distanceKm){
      score -= Math.min(35, Math.round((distance - dog.distanceKm) * 5));
      cautions.push(item('trail.distance.above-range',
        `The ${distance} km route exceeds this dog's effective ${dog.distanceKm} km range.`));
    }else{
      positives.push(item('trail.distance.within-range',
        `The ${distance} km route is within this dog’s effective range.`));
    }

    const ascent = numberOrNull(metrics.ascentM);
    if(ascent === null){
      unknowns.push(item('trail.ascent.unknown', 'Total ascent is unknown.'));
    }else if(ascent > dog.ascentM){
      score -= Math.min(20, Math.ceil((ascent - dog.ascentM) / 100) * 4);
      cautions.push(item('trail.ascent.above-range',
        `The ${ascent} m climb exceeds this dog's effective ${dog.ascentM} m climbing range.`));
    }else{
      positives.push(item('trail.ascent.within-range',
        `The ${ascent} m climb is within this dog’s effective range.`));
    }

    const descent = numberOrNull(metrics.descentM);
    if(descent === null){
      unknowns.push(item('trail.descent.unknown', 'Total descent is unknown.'));
    }else if((dog.fragile || dog.giant) && descent > 400){
      score -= Math.min(20, Math.ceil((descent - 400) / 100) * 4);
      cautions.push(item('trail.descent.joint-load',
        'The sustained descent may place extra load on joints.'));
    }

    if(suitability.exposure === null || suitability.exposure === undefined){
      unknowns.push(item('trail.exposure.unknown', 'Exposure and drop-offs have not been established.'));
    }else if(suitability.exposure){
      score -= 30 + ((dog.fragile || dog.impairedVision) ? 10 : 0);
      cautions.push(item('trail.exposure.present',
        'The route includes exposed terrain or drop-offs.'));
    }else{
      positives.push(item('trail.exposure.none-known', 'No exposed section is recorded.'));
    }

    if(suitability.heatRisk === 'high'){
      score -= dog.heatSensitive ? 25 : 12;
      cautions.push(item('trail.heat.high', dog.heatSensitive
        ? 'The route has high heat risk and this dog is heat-sensitive.'
        : 'The route has high baseline heat risk.'));
    }else if(suitability.heatRisk === 'moderate'){
      score -= dog.heatSensitive ? 10 : 4;
      cautions.push(item('trail.heat.moderate', dog.heatSensitive
        ? 'Moderate route heat risk matters more for this heat-sensitive dog.'
        : 'The route has moderate baseline heat risk.'));
    }else if(suitability.heatRisk === 'low'){
      positives.push(item('trail.heat.low', 'The route’s baseline heat risk is low.'));
    }else{
      unknowns.push(item('trail.heat.unknown', 'Baseline heat risk is unknown.'));
    }

    const shade = numberOrNull(suitability.shadePercent);
    if(shade === null){
      unknowns.push(item('trail.shade.unknown', 'Shade coverage is unknown.'));
    }else if(shade < 20){
      score -= 10;
      cautions.push(item('trail.shade.very-low', 'The route has very little shade.'));
    }else if(shade < 40){
      score -= 5;
      cautions.push(item('trail.shade.low', 'Shade is limited on this route.'));
    }else if(shade >= 60){
      positives.push(item('trail.shade.good', 'The route has substantial shade.'));
    }

    const hazards = Array.isArray(suitability.surfaceHazards)
      ? suitability.surfaceHazards : null;
    if(hazards === null){
      unknowns.push(item('trail.surface-hazards.unknown', 'Surface hazards are unknown.'));
    }else if(hazards.length){
      const multiplier = dog.fragile ? 1.5 : 1;
      score -= Math.min(dog.fragile ? 30 : 20, Math.round(hazards.length * 8 * multiplier));
      cautions.push(item('trail.surface-hazards.present',
        `${hazards.length} material surface hazard${hazards.length === 1 ? ' is' : 's are'} recorded.`));
    }else if(categories.surfaceHazards === 'verified'){
      positives.push(item('trail.surface-hazards.none-known',
        'No material surface hazard is recorded in the reviewed evidence.'));
    }

    if(access.status === 'prohibited'){
      hardStops.push(item('trail.dog-access.prohibited', 'Dogs are prohibited on this route.'));
      score = Math.min(score, 5);
    }else if(access.status === 'seasonal-restrictions'){
      cautions.push(item('trail.dog-access.seasonal',
        'Dog access has seasonal restrictions that must be checked for the hike date.'));
      score = Math.min(score, 84);
    }else if(access.status === 'leash-required'){
      positives.push(item('trail.dog-access.leash', 'Dogs are allowed when kept on a leash.'));
    }else if(access.status === 'allowed'){
      positives.push(item('trail.dog-access.allowed', 'The reviewed access rule allows dogs.'));
    }else{
      unknowns.push(item('trail.dog-access.unknown', 'The current dog-access rule is unknown.'));
    }

    const reviewedWater = parts.waypoints.some(point =>
      point.type === 'water' && point.status === 'reviewed');
    if(categories.water === 'verified'){
      if(reviewedWater){
        positives.push(item('trail.water.reviewed', 'At least one reviewed water point is recorded.'));
      }else{
        cautions.push(item('trail.water.none-reviewed',
          'No usable water point is confirmed; carry the full supply.'));
      }
    }

    if(conditions.status === 'known'){
      if(conditions.heatRisk === 'high'){
        score -= dog.heatSensitive ? 25 : 10;
        cautions.push(item('conditions.heat.high', dog.heatSensitive
          ? 'Current heat conditions are high-risk for this heat-sensitive dog.'
          : 'Current heat conditions add material risk.'));
      }else if(conditions.heatRisk === 'moderate'){
        score -= dog.heatSensitive ? 10 : 4;
        cautions.push(item('conditions.heat.moderate',
          'Current conditions add moderate heat load.'));
      }else if(conditions.heatRisk === 'low'){
        positives.push(item('conditions.heat.low', 'Current heat conditions are low-risk.'));
      }else{
        unknowns.push(item('conditions.heat.unknown', 'Current heat conditions are unavailable.'));
      }
    }else{
      unknowns.push(item('conditions.not-included',
        'Current weather and trail conditions are not included in this recommendation.'));
    }

    let verifiedCount = 0;
    let criticalUnknown = false;
    for(const category of REVIEW_CATEGORIES){
      if(categories[category] === 'verified'){
        verifiedCount += 1;
      }else{
        unknowns.push(item(`evidence.${category}.unverified`,
          `${category} evidence is ${categories[category] || 'unknown'}, not verified.`));
        if(CRITICAL_CATEGORIES.has(category)) criticalUnknown = true;
      }
    }

    if(criticalUnknown) score = Math.min(score, 80);
    score = Math.max(5, Math.min(100, Math.round(score)));

    const confidencePoints = verifiedCount + dog.completeness;
    const confidence = confidencePoints >= 9
      ? 'high'
      : confidencePoints >= 5 ? 'medium' : 'low';

    let category = score >= 85 ? 'strong-option'
      : score >= 60 ? 'possible-with-cautions'
      : 'not-recommended';
    if(hardStops.length) category = 'not-recommended';
    if(criticalUnknown && category === 'strong-option') category = 'possible-with-cautions';

    return {
      scoringVersion: VERSION,
      score,
      category,
      confidence,
      evidenceTier: parts.verification.tier || 'unknown',
      positiveReasons: unique(positives),
      cautions: unique(cautions),
      unknowns: unique(unknowns),
      hardStops: unique(hardStops),
      effectiveDogLimits: {
        terrainRank: dog.terrain,
        distanceKm: dog.distanceKm,
        ascentM: dog.ascentM,
        heatSensitive: dog.heatSensitive,
      },
    };
  }

  return {
    VERSION,
    FITNESS,
    calculateRecommendation,
  };
});
