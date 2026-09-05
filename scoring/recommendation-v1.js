(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsRecommendationV1 = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const VERSION = '1.4.0';
  const FITNESS = {
    low: { terrain: 0, distanceKm: 5, ascentM: 250 },
    moderate: { terrain: 1, distanceKm: 10, ascentM: 600 },
    high: { terrain: 2, distanceKm: 18, ascentM: 1200 },
  };
  // Ordered easiest-to-hardest. The index is the difficulty rank a rule
  // multiplies by, so a scale may gain values only at its end.
  const BEHAVIOUR_SCALES = {
    recall: ['reliable', 'variable', 'unreliable'],
    reactivity: ['none', 'mild', 'strong'],
    preyDrive: ['low', 'moderate', 'high'],
    livestockComfort: ['confident', 'cautious', 'reactive'],
    trafficComfort: ['confident', 'cautious', 'reactive'],
    crowdComfort: ['confident', 'cautious', 'reactive'],
    heatTolerance: ['robust', 'average', 'low'],
  };
  const BEHAVIOUR_KEYS = Object.keys(BEHAVIOUR_SCALES);
  // Behaviour is a fit signal layered on top of the physical assessment. It
  // is capped so a behavioural mismatch can move a route out of
  // "strong option" without ever outweighing terrain, exposure and access.
  const BEHAVIOUR_PENALTY_CAP = 45;
  // Reassurance requires evidence. A positive statement resting on a review
  // category ORMA has not reviewed is not shown at all: on an unreviewed
  // route, "no exposed section is recorded" reads as a safety claim when it
  // only means nobody looked. The matching `unknowns` entry is the honest
  // channel for that, and it already exists.
  //
  // Cautions are deliberately NOT filtered this way. Suppressing a warning
  // for want of a review would hide a real hazard and leave its penalty
  // unexplained; unreviewed evidence may fall short of reassuring without
  // falling short of worth mentioning.
  const REASSURANCE_EVIDENCE = [
    ['trail.terrain.', 'route'],
    ['trail.exposure.', 'exposure'],
    ['trail.heat.', 'heat'],
    ['trail.shade.', 'heat'],
    ['trail.surface-hazards.', 'surfaceHazards'],
    ['trail.dog-access.', 'access'],
    ['trail.water.', 'water'],
    ['trail.livestock.', 'livestock'],
  ];
  // Measured route metrics and the five behaviour attributes carry their own
  // evidence: a distance is computed from the geometry, and an attribute is
  // only ever set away from `unknown` by someone recording it.
  function reassuranceIsBacked(entry, categories){
    const rest = REASSURANCE_EVIDENCE.find(([prefix]) => entry.code.startsWith(prefix));
    return !rest || categories[rest[1]] === 'verified';
  }

  // A positioned advisory is only worth showing when ORMA stands behind where
  // it is. An unconfirmed community report waits for confirmation instead.
  const SEGMENT_SHOWN_STATUSES = new Set(['reviewed', 'mapped']);
  const SEGMENT_ADVISORIES = [
    'leash-required', 'leash-recommended', 'avoid', 'caution', 'information',
  ];
  const SEGMENT_TYPE_LABELS = {
    livestock: 'grazing livestock',
    wildlife: 'wildlife activity',
    road: 'road traffic',
    exposure: 'exposed ground',
    crowding: 'heavy foot traffic',
    surface: 'difficult footing',
    'water-scarce': 'no water access',
    other: 'a recorded caution',
  };
  const REVIEW_CATEGORIES = [
    'route', 'water', 'heat', 'exposure', 'livestock',
    'surfaceHazards', 'access',
  ];
  const CRITICAL_CATEGORIES = new Set([
    'route', 'exposure', 'surfaceHazards', 'access',
  ]);

  function item(code, message, vars, messageKey){
    return { code, message, vars:vars || null, messageKey:messageKey || code, impact:0 };
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

  // Returns the difficulty rank of a declared behaviour, or null when the
  // owner has not answered. Null must stay silent: an unanswered question is
  // not evidence of an easy dog.
  function behaviourRank(behaviour, key){
    const index = BEHAVIOUR_SCALES[key].indexOf(behaviour ? behaviour[key] : undefined);
    return index === -1 ? null : index;
  }

  function deriveBehaviour(dog){
    const source = dog && dog.behaviour ? dog.behaviour : {};
    const ranks = {};
    let declaredCount = 0;
    for(const key of BEHAVIOUR_KEYS){
      const rank = behaviourRank(source, key);
      ranks[key] = rank;
      if(rank !== null) declaredCount += 1;
    }
    const preferredDurationMin = Number.isFinite(source.preferredDurationMin)
      && source.preferredDurationMin > 0
      ? source.preferredDurationMin
      : null;
    if(preferredDurationMin !== null) declaredCount += 1;
    return { ...ranks, preferredDurationMin, declaredCount };
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
    const behaviour = deriveBehaviour(dog);
    // A declared low heat tolerance adds sensitivity. A declared robust
    // tolerance deliberately removes nothing: heat injury is fast and
    // irreversible, so an owner's confidence never lowers a safety guard.
    const heatSensitive = traits.heatSensitive === true || conditions.has('heat')
      || conditions.has('cardiac') || conditions.has('overweight')
      || behaviour.heatTolerance === 2;
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
      behaviour,
      // Confidence measures evidence quality, not behavioural detail, so
      // behaviour deliberately does not enter completeness. Adding it would
      // silently restate every reviewed fixture decision.
      completeness: [fitnessKnown, age !== null, weight !== null].filter(Boolean).length,
    };
  }

  // A segment is only usable when it names a real, ordered stretch of the
  // route. A malformed segment is dropped rather than rendered as a vague
  // warning, because "lead on somewhere" is worse than saying nothing.
  function usableSegments(trail){
    const segments = Array.isArray(trail && trail.segments) ? trail.segments : [];
    return segments.filter(segment => segment
      && SEGMENT_ADVISORIES.includes(segment.advisory)
      && Number.isFinite(segment.fromKm) && Number.isFinite(segment.toKm)
      && segment.fromKm >= 0 && segment.toKm > segment.fromKm)
      .slice()
      .sort((a, b) => a.fromKm - b.fromKm);
  }

  function formatKm(value){
    return Number(value.toFixed(1)).toString();
  }

  function trailParts(trail){
    trail = trail || {};
    return {
      metrics: trail.metrics || {},
      suitability: trail.suitability || {},
      waypoints: Array.isArray(trail.waypoints) ? trail.waypoints : [],
      segments: usableSegments(trail),
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

    // Every deduction is recorded on the entry that caused it. P0-1 ranks the
    // breakdown by these numbers, so a penalty applied without one would show
    // up as a factor that silently moved the score.
    function penalise(points, entry, bucket){
      const cost = Math.max(0, Math.round(points));
      score -= cost;
      entry.impact = -cost;
      (bucket || cautions).push(entry);
      return entry;
    }

    const terrain = numberOrNull(suitability.terrainRank);
    if(terrain === null){
      unknowns.push(item('trail.terrain.unknown', 'Terrain difficulty is unknown.'));
    }else if(terrain > dog.terrain){
      const penalty = (terrain - dog.terrain) * 30;
      penalise(penalty, item('trail.terrain.above-tolerance',
        `Terrain is above this dog's effective tolerance (${terrain} versus ${dog.terrain}).`,
        { terrain, tolerance:dog.terrain }));
    }else{
      positives.push(item('trail.terrain.within-tolerance',
        'Terrain is within this dog’s effective tolerance.'));
    }

    const distance = numberOrNull(metrics.distanceKm);
    if(distance === null){
      unknowns.push(item('trail.distance.unknown', 'Route distance is unknown.'));
    }else if(distance > dog.distanceKm){
      penalise(Math.min(35, Math.round((distance - dog.distanceKm) * 5)), item('trail.distance.above-range',
        `The ${distance} km route exceeds this dog's effective ${dog.distanceKm} km range.`,
        { distance, range:dog.distanceKm }));
    }else{
      positives.push(item('trail.distance.within-range',
        `The ${distance} km route is within this dog’s effective range.`, { distance }));
    }

    const ascent = numberOrNull(metrics.ascentM);
    if(ascent === null){
      unknowns.push(item('trail.ascent.unknown', 'Total ascent is unknown.'));
    }else if(ascent > dog.ascentM){
      penalise(Math.min(20, Math.ceil((ascent - dog.ascentM) / 100) * 4), item('trail.ascent.above-range',
        `The ${ascent} m climb exceeds this dog's effective ${dog.ascentM} m climbing range.`,
        { ascent, range:dog.ascentM }));
    }else{
      positives.push(item('trail.ascent.within-range',
        `The ${ascent} m climb is within this dog’s effective range.`, { ascent }));
    }

    const descent = numberOrNull(metrics.descentM);
    if(descent === null){
      unknowns.push(item('trail.descent.unknown', 'Total descent is unknown.'));
    }else if((dog.fragile || dog.giant) && descent > 400){
      penalise(Math.min(20, Math.ceil((descent - 400) / 100) * 4), item('trail.descent.joint-load',
        'The sustained descent may place extra load on joints.'));
    }

    if(suitability.exposure === null || suitability.exposure === undefined){
      unknowns.push(item('trail.exposure.unknown', 'Exposure and drop-offs have not been established.'));
    }else if(suitability.exposure){
      penalise(30 + ((dog.fragile || dog.impairedVision) ? 10 : 0), item('trail.exposure.present',
        'The route includes exposed terrain or drop-offs.'));
    }else{
      positives.push(item('trail.exposure.none-known', 'No exposed section is recorded.'));
    }

    if(suitability.heatRisk === 'high'){
      penalise(dog.heatSensitive ? 25 : 12, item('trail.heat.high', dog.heatSensitive
        ? 'The route has high heat risk and this dog is heat-sensitive.'
        : 'The route has high baseline heat risk.', null,
      dog.heatSensitive ? 'trail.heat.high.sensitive' : 'trail.heat.high'));
    }else if(suitability.heatRisk === 'moderate'){
      penalise(dog.heatSensitive ? 10 : 4, item('trail.heat.moderate', dog.heatSensitive
        ? 'Moderate route heat risk matters more for this heat-sensitive dog.'
        : 'The route has moderate baseline heat risk.', null,
      dog.heatSensitive ? 'trail.heat.moderate.sensitive' : 'trail.heat.moderate'));
    }else if(suitability.heatRisk === 'low'){
      positives.push(item('trail.heat.low', 'The route’s baseline heat risk is low.'));
    }else{
      unknowns.push(item('trail.heat.unknown', 'Baseline heat risk is unknown.'));
    }

    const shade = numberOrNull(suitability.shadePercent);
    if(shade === null){
      unknowns.push(item('trail.shade.unknown', 'Shade coverage is unknown.'));
    }else if(shade < 20){
      penalise(10, item('trail.shade.very-low', 'The route has very little shade.'));
    }else if(shade < 40){
      penalise(5, item('trail.shade.low', 'Shade is limited on this route.'));
    }else if(shade >= 60){
      positives.push(item('trail.shade.good', 'The route has substantial shade.'));
    }

    const hazards = Array.isArray(suitability.surfaceHazards)
      ? suitability.surfaceHazards : null;
    if(hazards === null){
      unknowns.push(item('trail.surface-hazards.unknown', 'Surface hazards are unknown.'));
    }else if(hazards.length){
      const multiplier = dog.fragile ? 1.5 : 1;
      const hazardCost = Math.min(dog.fragile ? 30 : 20, Math.round(hazards.length * 8 * multiplier));
      const hazardSummary = hazards
        .map(hazard => String(hazard).trim().replace(/[.;]+$/, ''))
        .filter(Boolean)
        .join('; ');
      penalise(hazardCost, item('trail.surface-hazards.present',
        `Recorded route cautions: ${hazardSummary}.`,
        { count:hazards.length, hazards:hazardSummary },
        hazards.length === 1 ? 'trail.surface-hazards.present.one' : 'trail.surface-hazards.present.many'));
    }else if(categories.surfaceHazards === 'verified'){
      positives.push(item('trail.surface-hazards.none-known',
        'No material surface hazard is recorded in the reviewed evidence.'));
    }

    if(access.status === 'prohibited'){
      const stop = item('trail.dog-access.prohibited', 'Dogs are prohibited on this route.');
      // A prohibition is not a deduction, it is a ceiling. Recording the drop
      // it actually caused keeps the breakdown's numbers adding up.
      stop.impact = Math.min(0, 5 - score);
      hardStops.push(stop);
      score = Math.min(score, 5);
    }else if(access.status === 'seasonal-restrictions'){
      const seasonalEntry = item('trail.dog-access.seasonal',
        'Dog access has seasonal restrictions that must be checked for the hike date.');
      seasonalEntry.impact = Math.min(0, 84 - score);
      cautions.push(seasonalEntry);
      score = Math.min(score, 84);
    }else if(access.status === 'leash-required'){
      positives.push(item('trail.dog-access.leash', 'Dogs are allowed when kept on a leash.'));
    }else if(access.status === 'allowed'){
      positives.push(item('trail.dog-access.allowed', 'The reviewed access rule allows dogs.'));
    }else{
      unknowns.push(item('trail.dog-access.unknown', 'The current dog-access rule is unknown.'));
    }

    const reviewedWaterCount = parts.waypoints.filter(point =>
      point.type === 'water' && point.status === 'reviewed').length;
    if(categories.water === 'verified'){
      if(reviewedWaterCount > 0){
        positives.push(item('trail.water.reviewed',
          reviewedWaterCount === 1
            ? 'Water is available at one reviewed point.'
            : `Water is available at ${reviewedWaterCount} reviewed points.`,
          { count:reviewedWaterCount },
          reviewedWaterCount === 1 ? 'trail.water.reviewed.one' : 'trail.water.reviewed.many'));
      }else{
        cautions.push(item('trail.water.none-reviewed',
          'No usable water point is confirmed; carry the full supply.'));
      }
    }

    // ---- Behaviour-aware fit (v1.2.0) -------------------------------------
    // Every rule below needs BOTH a recorded route attribute and a declared
    // behaviour. An undeclared behaviour stays silent in both directions: it
    // never invents a penalty, and it never invents reassurance. An unknown
    // route attribute is reported as unknown only when the owner declared a
    // behaviour it would have interacted with, so quiet profiles keep a
    // short explanation.
    const behaviour = dog.behaviour;
    const recall = behaviour.recall;
    const preyDrive = behaviour.preyDrive;
    const reactivity = behaviour.reactivity;
    const livestockComfort = behaviour.livestockComfort;
    const trafficComfort = behaviour.trafficComfort;
    const crowdComfort = behaviour.crowdComfort;
    let behaviourPenalty = 0;
    // Behaviour charges are collected raw and settled after the cap, so each
    // entry's recorded impact is its share of what was actually deducted.
    const behaviourCharges = [];

    function chargeBehaviour(points, entry){
      const raw = Math.max(0, Math.round(points));
      behaviourPenalty += raw;
      behaviourCharges.push({ entry, raw });
      cautions.push(entry);
      return entry;
    }

    const rank = value => (value === null ? 0 : value);
    const declaredAny = (...values) => values.some(value => value !== null);

    const livestockPresence = suitability.livestockPresence;
    const stockRelevant = declaredAny(livestockComfort, preyDrive, recall);
    if(livestockPresence === 'likely' || livestockPresence === 'seasonal'){
      const seasonal = livestockPresence === 'seasonal';
      const drivers = [];
      let load = 0;
      if(rank(livestockComfort) > 0){
        load += livestockComfort * 9;
        drivers.push(livestockComfort === 2
          ? 'this dog reacts to livestock'
          : 'this dog is unsure around livestock');
      }
      if(rank(preyDrive) > 0){
        load += preyDrive * 5;
        drivers.push(preyDrive === 2 ? 'prey drive is high' : 'prey drive is moderate');
      }
      if(rank(recall) > 0){
        load += recall * 5;
        drivers.push(recall === 2 ? 'recall is unreliable' : 'recall is variable');
      }
      if(load > 0){
        const summary = drivers.join(', ');
        chargeBehaviour(Math.round(load * (seasonal ? 0.6 : 1)), item('trail.livestock.behaviour-risk',
          `${seasonal ? 'Livestock graze this route in season' : 'Grazing livestock is recorded on this route'}, and ${summary}.`,
          { presence:livestockPresence, drivers:summary },
          seasonal ? 'trail.livestock.behaviour-risk.seasonal' : 'trail.livestock.behaviour-risk'));
      }
    }else if(livestockPresence === 'none' && stockRelevant){
      positives.push(item('trail.livestock.none',
        'No grazing livestock is recorded on this route.'));
    }else if(stockRelevant){
      unknowns.push(item('trail.livestock.presence-unknown',
        'Whether livestock graze this route is unknown. Carry a lead for open pasture.'));
    }

    const wildlifePresence = suitability.wildlifePresence;
    const chaseRelevant = declaredAny(preyDrive, recall);
    if(wildlifePresence === 'high' || wildlifePresence === 'moderate'){
      const high = wildlifePresence === 'high';
      let load = 0;
      if(rank(preyDrive) > 0) load += preyDrive * (high ? 6 : 3);
      if(rank(recall) > 0) load += recall * (high ? 4 : 2);
      if(load > 0){
        chargeBehaviour(Math.round(load), item('trail.wildlife.chase-risk',
          high
            ? 'Wildlife is active on this route, which matters for a dog that chases.'
            : 'Some wildlife activity is recorded here, which matters for a dog that chases.',
          { presence:wildlifePresence },
          high ? 'trail.wildlife.chase-risk.high' : 'trail.wildlife.chase-risk.moderate'));
      }
    }else if(wildlifePresence === 'low' && chaseRelevant){
      positives.push(item('trail.wildlife.low', 'Little wildlife activity is recorded here.'));
    }

    const sightlines = suitability.sightlines;
    if(rank(recall) > 0){
      if(sightlines === 'open'){
        positives.push(item('trail.sightlines.open',
          'Open sightlines keep this dog visible on most sections.'));
      }else if(sightlines === 'restricted'){
        chargeBehaviour(recall * 5, item('trail.sightlines.restricted',
          'Enclosed, twisting ground makes it harder to keep this dog in view.'));
      }
    }

    const roadProximity = suitability.roadProximity;
    const trafficRelevant = declaredAny(trafficComfort, recall);
    if(roadProximity === 'alongside' || roadProximity === 'crossings'){
      const alongside = roadProximity === 'alongside';
      let load = 0;
      if(rank(trafficComfort) > 0) load += trafficComfort * (alongside ? 7 : 4);
      if(rank(recall) > 0) load += recall * (alongside ? 4 : 2);
      if(load > 0){
        chargeBehaviour(Math.round(load), item('trail.road.traffic-risk',
          alongside
            ? 'The route runs alongside a road, which matters for this dog around traffic.'
            : 'The route crosses a road, which matters for this dog around traffic.',
          { proximity:roadProximity },
          alongside ? 'trail.road.traffic-risk.alongside' : 'trail.road.traffic-risk.crossings'));
      }
    }else if(roadProximity === 'none' && trafficRelevant){
      positives.push(item('trail.road.none', 'The route keeps clear of roads and traffic.'));
    }

    const crowding = suitability.crowding;
    const socialRelevant = declaredAny(crowdComfort, reactivity);
    const socialRank = Math.max(rank(crowdComfort), rank(reactivity));
    if(crowding === 'busy' || crowding === 'moderate'){
      const busy = crowding === 'busy';
      if(socialRank > 0){
        chargeBehaviour(Math.round(socialRank * (busy ? 8 : 4)), item('trail.crowding.social-risk',
          busy
            ? 'This is a busy route, and this dog needs space from other people and dogs.'
            : 'This route sees steady foot traffic, and this dog needs space from other people and dogs.',
          { crowding },
          busy ? 'trail.crowding.social-risk.busy' : 'trail.crowding.social-risk.moderate'));
      }
    }else if(crowding === 'quiet' && socialRelevant){
      positives.push(item('trail.crowding.quiet',
        'This is a quiet route with room to give other walkers space.'));
    }

    const preferredDurationMin = behaviour.preferredDurationMin;
    const durationMinutes = numberOrNull(metrics.durationMinutes);
    if(preferredDurationMin !== null && durationMinutes !== null){
      if(durationMinutes > preferredDurationMin * 1.25){
        chargeBehaviour(Math.min(10, Math.ceil((durationMinutes - preferredDurationMin) / 30) * 3), item('trail.duration.above-preference',
          `At about ${Math.round(durationMinutes)} minutes this route runs longer than the preferred ${preferredDurationMin} minutes.`,
          { durationMinutes:Math.round(durationMinutes), preferredDurationMin }));
      }else{
        positives.push(item('trail.duration.within-preference',
          `At about ${Math.round(durationMinutes)} minutes this route fits the preferred walk length.`,
          { durationMinutes:Math.round(durationMinutes), preferredDurationMin }));
      }
    }

    if(behaviourPenalty > 0){
      const applied = Math.min(BEHAVIOUR_PENALTY_CAP, behaviourPenalty);
      score -= applied;
      // Share the applied total across the charges in proportion to their raw
      // load. Uncapped this is exact; capped, every entry shrinks together
      // rather than one arbitrarily absorbing the whole reduction.
      // Largest-remainder allocation. Rounding each share independently can
      // leave the recorded costs a point or two off what was deducted, which
      // would break the one property the breakdown depends on.
      const ratio = applied / behaviourPenalty;
      const shares = behaviourCharges.map(charge => {
        const exact = charge.raw * ratio;
        const whole = Math.floor(exact);
        return { charge, whole, remainder:exact - whole };
      });
      let allocated = shares.reduce((sum, share) => sum + share.whole, 0);
      shares
        .slice()
        .sort((a, b) => b.remainder - a.remainder)
        .forEach(share => { if(allocated < applied){ share.whole += 1; allocated += 1; } });
      shares.forEach(share => { share.charge.entry.impact = -share.whole; });
    }

    // ---- Route segments ---------------------------------------------------
    // Segments carry the "where" of an advisory. The aggregate rules above
    // already carry the score, so a lead advisory is explanation rather than
    // a second penalty for the same fact. Only "avoid" describes a hazard
    // that no aggregate attribute represents, so only it is scored here.
    const leashAdvisories = [];
    for(const segment of parts.segments){
      if(!SEGMENT_SHOWN_STATUSES.has(segment.status)) continue;
      const label = SEGMENT_TYPE_LABELS[segment.type] || SEGMENT_TYPE_LABELS.other;
      const fromKm = formatKm(segment.fromKm);
      const toKm = formatKm(segment.toKm);
      const vars = {
        fromKm:Number(fromKm), toKm:Number(toKm),
        type:segment.type || 'other', label,
        note:typeof segment.note === 'string' && segment.note.trim() ? segment.note.trim() : null,
      };
      // Two short sentences: what is there, then what to do about it.
      const detail = vars.note || label;
      const where = `${detail.charAt(0).toUpperCase()}${detail.slice(1)} between kilometres ${fromKm} and ${toKm}.`;
      if(segment.advisory === 'leash-required' || segment.advisory === 'leash-recommended'){
        const required = segment.advisory === 'leash-required';
        leashAdvisories.push({ ...vars, advisory:segment.advisory });
        cautions.push(item(`segment.${segment.advisory}.${vars.type}.${fromKm}-${toKm}`,
          `${where} ${required ? 'Lead required.' : 'Lead recommended.'}`,
          vars,
          required ? 'segment.leash-required' : 'segment.leash-recommended'));
      }else if(segment.advisory === 'avoid'){
        penalise(20, item(`segment.avoid.${vars.type}.${fromKm}-${toKm}`,
          `${where} Avoid this stretch.`, vars, 'segment.avoid'));
      }else if(segment.advisory === 'caution'){
        cautions.push(item(`segment.caution.${vars.type}.${fromKm}-${toKm}`,
          `${where} Take care here.`, vars, 'segment.caution'));
      }else{
        positives.push(item(`segment.information.${vars.type}.${fromKm}-${toKm}`,
          where, vars, 'segment.information'));
      }
    }

    if(conditions.status === 'known'){
      if(conditions.heatRisk === 'high'){
        penalise(dog.heatSensitive ? 25 : 10, item('conditions.heat.high', dog.heatSensitive
          ? 'Current heat conditions are high-risk for this heat-sensitive dog.'
          : 'Current heat conditions add material risk.', null,
        dog.heatSensitive ? 'conditions.heat.high.sensitive' : 'conditions.heat.high'));
      }else if(conditions.heatRisk === 'moderate'){
        penalise(dog.heatSensitive ? 10 : 4, item('conditions.heat.moderate',
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
        const planningGuidance = {
          route: 'Route details are based on available map data.',
          water: 'Plan to carry enough water for the full walk.',
          heat: 'Check the live forecast and plan for limited shade.',
          exposure: 'Check recent local guidance for narrow or exposed sections.',
          livestock: 'Keep a leash ready near grazing land.',
          surfaceHazards: 'Expect variable mountain footing.',
          access: 'Check current local access rules before travelling.',
        };
        unknowns.push(item(`evidence.${category}.unverified`, planningGuidance[category]));
        if(CRITICAL_CATEGORIES.has(category)) criticalUnknown = true;
      }
    }

    if(criticalUnknown && score > 80){
      const ceiling = item('evidence.critical.capped',
        'Unreviewed safety evidence holds this recommendation below a strong option.');
      ceiling.impact = 80 - score;
      // This moved the score, so it belongs in the breakdown rather than in
      // the unknowns disclosure, which factors deliberately does not include.
      cautions.push(ceiling);
      score = 80;
    }
    // The breakdown's numbers must add up to the number on the card. When the
    // demands exceed everything the dog has, the floor is what the reader sees,
    // so the floor is recorded rather than left as an unexplained gap.
    const rawScore = Math.round(score);
    score = Math.max(5, Math.min(100, rawScore));
    if(rawScore < 5){
      const floor = item('score.floor',
        'The demands above already exceed what this dog can comfortably take, so the score rests at its floor.');
      floor.impact = 5 - rawScore;
      cautions.push(floor);
    }

    const shownPositives = unique(positives).filter(entry => reassuranceIsBacked(entry, categories));
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
      positiveReasons: shownPositives,
      // Descending order of impact, top negative first. Ties keep the order the
      // engine evaluated them in, so the list is stable between runs.
      factors: [...unique(hardStops), ...unique(cautions), ...shownPositives]
        .map((entry, index) => ({ ...entry, order:index }))
        .sort((a, b) => a.impact - b.impact || a.order - b.order)
        .map(({ order, ...entry }) => entry),
      cautions: unique(cautions),
      unknowns: unique(unknowns),
      hardStops: unique(hardStops),
      effectiveDogLimits: {
        terrainRank: dog.terrain,
        distanceKm: dog.distanceKm,
        ascentM: dog.ascentM,
        heatSensitive: dog.heatSensitive,
      },
      // Ordered by start distance so navigation can consume them directly
      // without re-deriving where a lead advisory begins.
      leashAdvisories,
      behaviourDeclaredCount: dog.behaviour.declaredCount,
    };
  }

  return {
    VERSION,
    FITNESS,
    calculateRecommendation,
  };
});
