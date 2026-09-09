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

  // `extra` carries what the engine does not know, such as the dog's name, so
  // a translation can say "fine for Teo" where the engine said "this dog".
  function translatedMessage(item, translate, extra){
    if(!(item && item.message)) return '';
    if(typeof translate !== 'function') return item.message;
    const key = `recommendation.reason.${item.messageKey || item.code}`;
    const vars = extra || item.vars ? { ...(extra || {}), ...(item.vars || {}) } : undefined;
    const value = translate(key, vars);
    return value && value !== key ? value : item.message;
  }

  function messages(items, translate, extra){
    return (Array.isArray(items) ? items : [])
      .map(item => translatedMessage(item, translate, extra))
      .filter(Boolean);
  }

  // A positive that cost nothing is not worth a sentence of its own. These
  // are the short forms that let the card say "Fine for Teo: the 7.5 km
  // distance, the 150 m climb and today's temperatures." in one line. A
  // positive without a short form keeps its own row.
  const FINE_PHRASES = Object.freeze({
    'trail.distance.within-range': 'the {distance} km distance',
    'trail.ascent.within-range': 'the {ascent} m climb',
    'trail.terrain.within-tolerance': 'the terrain',
    'trail.duration.within-preference': 'the walking time',
    'conditions.heat.low': 'today’s temperatures',
    'trail.heat.low': 'heat exposure',
    'trail.shade.good': 'shade',
    'trail.exposure.none-known': 'no exposed sections',
    'trail.surface-hazards.none-known': 'no recorded surface hazards',
    'trail.water.reviewed': 'water on the route',
    'trail.dog-access.allowed': 'dog access',
    'trail.dog-access.leash': 'dog access on a leash',
    'trail.livestock.none': 'no livestock recorded',
    'trail.wildlife.low': 'low wildlife activity',
    'trail.road.none': 'no road sections',
    'trail.crowding.quiet': 'a quiet route',
    'trail.sightlines.open': 'open sightlines',
  });

  // Calm framing: confidence describes data completeness, not danger.
  // "low" must not read as a warning, missing data never lowers the score.
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
    // behaviour and positioned advisory last, exactly the lines worth
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
    const dogName = String(context.dogName || '').trim();
    const subject = dogName || tr('recommendation.subject.guest', 'a medium dog');
    const extra = { name:subject };

    const codesOf = items => new Set((Array.isArray(items) ? items : [])
      .filter(Boolean).map(item => item.code).filter(Boolean));
    const positiveCodes = codesOf(recommendation.positiveReasons);
    const stopCodes = codesOf(recommendation.hardStops);
    const kindOf = entry => stopCodes.has(entry.code) ? 'stop'
      : positiveCodes.has(entry.code) ? 'positive'
      : 'caution';

    const allFactors = (Array.isArray(recommendation.factors) ? recommendation.factors : [])
      .filter(entry => entry && typeof entry.message === 'string');
    const floorEntry = allFactors.find(entry => entry.code === 'score.floor') || null;
    const breakdownFactors = allFactors
      .filter(entry => entry !== floorEntry)
      .map(entry => ({
        impact:Number.isFinite(entry.impact) ? entry.impact : 0,
        message:translatedMessage(entry, translate, extra),
        code:entry.code,
        kind:kindOf(entry),
      }));
    // The rows the card lists one by one, and the positives it folds into a
    // single "fine for" line. Cost rows keep their points; a positive stays a
    // row only when it has no short form.
    const finePhrase = entry => {
      const fallback = FINE_PHRASES[entry.code];
      if(!fallback) return null;
      return tr(`recommendation.fine.${entry.code}`, fallback, { ...extra, ...(entry.vars || {}) });
    };
    const fine = [];
    const rows = [];
    for(const entry of breakdownFactors){
      const phrase = entry.kind === 'positive' && entry.impact >= 0
        ? finePhrase(allFactors.find(factor => factor.code === entry.code) || entry)
        : null;
      if(phrase) fine.push(phrase);
      else rows.push(entry);
    }
    const joined = fine.length <= 1 ? fine.join('') : tr('recommendation.list.and', '{first} and {last}', {
      first:fine.slice(0, -1).join(', '),
      last:fine[fine.length - 1],
    });

    const rankedReasons = ordered(
      (Array.isArray(recommendation.positiveReasons) ? recommendation.positiveReasons : [])
        .filter(Boolean),
      REASON_TIERS, REASON_TIERS.length);
    const rankedCautions = ordered(
      (Array.isArray(recommendation.cautions) ? recommendation.cautions : []).filter(Boolean),
      CAUTION_TIERS, CAUTION_TIERS.length);

    const reasons = messages(rankedReasons, translate, extra);
    // Hard stops always lead: nothing below them changes the decision.
    const cautions = messages(recommendation.hardStops, translate, extra)
      .concat(messages(rankedCautions, translate, extra));
    const rawUnknowns = (Array.isArray(recommendation.unknowns) ? recommendation.unknowns : [])
      .filter(Boolean);
    const unknowns = messages(rawUnknowns, translate, extra);
    // The unknown codes encode their owner: dog.* gaps are fixable by the
    // user right now (profile fields); everything else is trail data.
    const dogGapFields = rawUnknowns
      .filter(item => typeof item.code === 'string' && item.code.startsWith('dog.'))
      .map(item => item.code.split('.')[1])
      .filter(Boolean);

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
      // summary lists above this is not truncated, the acceptance criterion
      // is that it lists exactly the factors the score was computed from.
      breakdownFor:subject,
      breakdown:breakdownFactors,
      breakdownRows:rows,
      fine,
      fineLine:fine.length
        ? tr('recommendation.fine.line', 'Fine for {name}: {items}.', { name:subject, items:joined })
        : null,
      // The floor is not a factor the reader can act on, and rendering its
      // positive impact alongside the costs reads as a bonus. It closes the
      // list as a note instead, explaining why the total stops where it does.
      breakdownNote:floorEntry ? translatedMessage(floorEntry, translate, extra) : null,
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

  // P0-3: what changed when the reader added their own dog. A move of two
  // points or less is not a move, claiming one would be inventing drama the
  // score does not support.
  const SAME_SCORE_TOLERANCE = 2;

  function firstRunCallout(before, after, translate){
    if(!before || !after) return null;
    if(!Number.isFinite(before.score) || !Number.isFinite(after.score)) return null;
    if(!before.forName || !after.forName || before.forName === after.forName) return null;

    const tr = (key, fallback, vars) => {
      if(typeof translate === 'function'){
        const value = translate(key, vars);
        if(value && value !== key) return value;
      }
      let output = fallback;
      for(const name of Object.keys(vars || {})) output = output.split(`{${name}}`).join(vars[name]);
      return output;
    };

    if(Math.abs(after.score - before.score) <= SAME_SCORE_TOLERANCE){
      return tr('recommendation.firstRun.same',
        'Same score for {name} as for {before} on this trail.',
        { name:after.forName, before:before.forName });
    }
    return tr('recommendation.firstRun.moved',
      'Was {beforeScore}% for {before} · now {afterScore}% for {name}. See why below.',
      { beforeScore:before.score, before:before.forName, afterScore:after.score, name:after.forName });
  }

  return Object.freeze({ CATEGORY, SAME_SCORE_TOLERANCE, present, translatedMessage, firstRunCallout });
});
