(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsRecommendationDecision = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const CATEGORY = Object.freeze({
    'strong-option': { label:'Strong option', tone:'strong' },
    'possible-with-cautions': { label:'Possible with cautions', tone:'caution' },
    'not-recommended': { label:'Not recommended', tone:'stop' },
  });

  function translatedMessage(item, translate){
    if(!(item && item.message)) return '';
    if(typeof translate !== 'function') return item.message;
    const key = `recommendation.reason.${item.messageKey || item.code}`;
    const value = translate(key, item.vars || undefined);
    return value && value !== key ? value : item.message;
  }

  function messages(items, translate){
    return (Array.isArray(items) ? items : [])
      .map(item => translatedMessage(item, translate))
      .filter(Boolean);
  }

  // Calm framing: confidence describes data completeness, not danger.
  // "low" must not read as a warning — missing data never lowers the score.
  const CONFIDENCE_LABEL = Object.freeze({
    high: 'Based on detailed trail data',
    medium: 'Based on available trail data',
    low: 'Based on partial data',
  });

  function present(recommendation, context){
    recommendation = recommendation || {};
    context = context || {};
    const category = CATEGORY[recommendation.category] || {
      label:'Recommendation unavailable',
      tone:'unknown',
    };
    const translate = context.translate;
    const tr = (key, fallback, vars) => {
      if(typeof translate === 'function'){
        const value = translate(key, vars);
        if(value && value !== key) return value;
      }
      let output = fallback;
      for(const name of Object.keys(vars || {})){
        output = output.split(`{${name}}`).join(vars[name]);
      }
      return output;
    };
    // Only four reasons and four cautions reach the card, so what survives the
    // cut decides whether the explanation reads as specific to this dog or as
    // boilerplate. The engine emits in calculation order, which puts every
    // behaviour and positioned advisory last — exactly the lines worth
    // showing. Rank before slicing; ties keep the engine's own order.
    const rank = (tiers, fallback) => item => {
      const code = typeof item.code === 'string' ? item.code : '';
      const index = tiers.findIndex(tier => tier.some(prefix => code.startsWith(prefix)));
      return index === -1 ? fallback : index;
    };
    const ordered = (items, tiers, fallback) => {
      const score = rank(tiers, fallback);
      return items
        .map((item, index) => ({ item, index, tier:score(item) }))
        .sort((a, b) => a.tier - b.tier || a.index - b.index)
        .map(entry => entry.item);
    };

    const REASON_TIERS = [
      // What the owner asked for: does this route fit this dog, this walk?
      ['trail.distance.within-range', 'trail.duration.within-preference'],
      // Present properties an owner plans around, and that are true of this
      // dog in particular.
      ['trail.sightlines.', 'trail.water.reviewed'],
      // Absences rank below presences: "no livestock recorded" is weaker
      // information than "water at two points", and reads as filler when it
      // crowds out a fact the owner can act on.
      ['trail.livestock.none', 'trail.wildlife.low', 'trail.road.none',
        'trail.crowding.quiet', 'trail.dog-access.'],
    ];
    const CAUTION_TIERS = [
      // Route facts that can end a walk.
      ['trail.dog-access.', 'trail.exposure.present', 'trail.terrain.above-tolerance',
        'segment.avoid'],
      // Positioned and behavioural: specific, and actionable on the day.
      ['segment.', 'trail.livestock.', 'trail.wildlife.', 'trail.road.',
        'trail.sightlines.', 'trail.crowding.'],
    ];
    const allFactors = (Array.isArray(recommendation.factors) ? recommendation.factors : [])
      .filter(entry => entry && typeof entry.message === 'string');
    const floorEntry = allFactors.find(entry => entry.code === 'score.floor') || null;
    const breakdownFactors = allFactors
      .filter(entry => entry !== floorEntry)
      .map(entry => ({
        impact:Number.isFinite(entry.impact) ? entry.impact : 0,
        message:translatedMessage(entry, translate),
        code:entry.code,
      }));

    const rankedReasons = ordered(
      (Array.isArray(recommendation.positiveReasons) ? recommendation.positiveReasons : [])
        .filter(Boolean),
      REASON_TIERS, REASON_TIERS.length);
    const rankedCautions = ordered(
      (Array.isArray(recommendation.cautions) ? recommendation.cautions : []).filter(Boolean),
      CAUTION_TIERS, CAUTION_TIERS.length);

    const reasons = messages(rankedReasons, translate);
    // Hard stops always lead: nothing below them changes the decision.
    const cautions = messages(recommendation.hardStops, translate)
      .concat(messages(rankedCautions, translate));
    const rawUnknowns = (Array.isArray(recommendation.unknowns) ? recommendation.unknowns : [])
      .filter(Boolean);
    const unknowns = messages(rawUnknowns, translate);
    // The unknown codes encode their owner: dog.* gaps are fixable by the
    // user right now (profile fields); everything else is trail data.
    const dogGapFields = rawUnknowns
      .filter(item => typeof item.code === 'string' && item.code.startsWith('dog.'))
      .map(item => item.code.split('.')[1])
      .filter(Boolean);
    const dogName = String(context.dogName || '').trim();

    return {
      confidenceLabel:recommendation.confidence && CONFIDENCE_LABEL[recommendation.confidence]
        ? tr(`recommendation.confidence.${recommendation.confidence}`, CONFIDENCE_LABEL[recommendation.confidence])
        : null,
      dogGapFields,
      trailUnknownCount:rawUnknowns.length - dogGapFields.length,
      conclusion:tr(`recommendation.category.${recommendation.category || 'unavailable'}`, category.label),
      tone:category.tone,
      score:Number.isFinite(recommendation.score) ? recommendation.score : null,
      confidence:recommendation.confidence || 'unknown',
      scoringVersion:recommendation.scoringVersion || 'unknown',
      evidenceTier:recommendation.evidenceTier || 'unknown',
      contextLabel:dogName
        ? tr('recommendation.context.dog', 'Recommendation for {name}', { name:dogName })
        : tr('recommendation.context.guest', 'Unpersonalized planning view'),
      dogName:dogName || null,
      reasons:reasons.slice(0, 4),
      cautions:cautions.slice(0, 4),
      // P0-1: the full ordered breakdown, most negative first. Unlike the two
      // summary lists above this is not truncated — the acceptance criterion
      // is that it lists exactly the factors the score was computed from.
      breakdownFor:dogName || 'a medium dog',
      breakdown:breakdownFactors,
      // The floor is not a factor the reader can act on, and rendering its
      // positive impact alongside the costs reads as a bonus. It closes the
      // list as a note instead, explaining why the total stops where it does.
      breakdownNote:floorEntry ? translatedMessage(floorEntry, translate) : null,
      unknowns:unknowns.slice(0, 5),
      additionalUnknowns:Math.max(0, unknowns.length - 5),
      heroSummary:dogName
        ? tr('recommendation.hero.dog', '{conclusion} for {name}.', {
          conclusion:tr(`recommendation.category.${recommendation.category || 'unavailable'}`, category.label),
          name:dogName,
        })
        : tr('recommendation.hero.guest', '{conclusion} in an unpersonalized planning view.', {
          conclusion:tr(`recommendation.category.${recommendation.category || 'unavailable'}`, category.label),
        }),
    };
  }

  return Object.freeze({ CATEGORY, present, translatedMessage });
});
