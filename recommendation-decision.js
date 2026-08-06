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

  function messages(items){
    return (Array.isArray(items) ? items : [])
      .map(item => item && item.message)
      .filter(Boolean);
  }

  // Calm framing: confidence describes data completeness, not danger.
  // "low" must not read as a warning — missing data never lowers the score.
  const CONFIDENCE_LABEL = Object.freeze({
    high: 'Well-verified data',
    medium: 'Partly verified data',
    low: 'Based on partial data',
  });

  function present(recommendation, context){
    recommendation = recommendation || {};
    context = context || {};
    const category = CATEGORY[recommendation.category] || {
      label:'Recommendation unavailable',
      tone:'unknown',
    };
    const reasons = messages(recommendation.positiveReasons);
    const cautions = messages(recommendation.hardStops).concat(messages(recommendation.cautions));
    const rawUnknowns = (Array.isArray(recommendation.unknowns) ? recommendation.unknowns : [])
      .filter(Boolean);
    const unknowns = messages(rawUnknowns);
    // The unknown codes encode their owner: dog.* gaps are fixable by the
    // user right now (profile fields); everything else is trail data.
    const dogGapFields = rawUnknowns
      .filter(item => typeof item.code === 'string' && item.code.startsWith('dog.'))
      .map(item => item.code.split('.')[1])
      .filter(Boolean);
    const dogName = String(context.dogName || '').trim();

    return {
      confidenceLabel:CONFIDENCE_LABEL[recommendation.confidence] || null,
      dogGapFields,
      trailUnknownCount:rawUnknowns.length - dogGapFields.length,
      conclusion:category.label,
      tone:category.tone,
      score:Number.isFinite(recommendation.score) ? recommendation.score : null,
      confidence:recommendation.confidence || 'unknown',
      scoringVersion:recommendation.scoringVersion || 'unknown',
      evidenceTier:recommendation.evidenceTier || 'unknown',
      contextLabel:dogName ? `Recommendation for ${dogName}` : 'Unpersonalized planning view',
      dogName:dogName || null,
      reasons:reasons.slice(0, 4),
      cautions:cautions.slice(0, 4),
      unknowns:unknowns.slice(0, 5),
      additionalUnknowns:Math.max(0, unknowns.length - 5),
      heroSummary:dogName
        ? `${category.label} for ${dogName}.`
        : `${category.label} in an unpersonalized planning view.`,
    };
  }

  return Object.freeze({ CATEGORY, present });
});
