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
    const reasons = messages(recommendation.positiveReasons, translate);
    const cautions = messages(recommendation.hardStops, translate)
      .concat(messages(recommendation.cautions, translate));
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
