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

  function present(recommendation, context){
    recommendation = recommendation || {};
    context = context || {};
    const category = CATEGORY[recommendation.category] || {
      label:'Recommendation unavailable',
      tone:'unknown',
    };
    const reasons = messages(recommendation.positiveReasons);
    const cautions = messages(recommendation.hardStops).concat(messages(recommendation.cautions));
    const unknowns = messages(recommendation.unknowns);
    const dogName = String(context.dogName || '').trim();

    return {
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
