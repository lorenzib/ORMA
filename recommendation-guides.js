(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsRecommendationGuides = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const GUIDES = Object.freeze({
    heat:Object.freeze({
      id:'heat',
      href:'guides/heat-overheating.html',
      label:'Recognising overheating early',
      summary:'Know the early signs and when to stop.',
    }),
    water:Object.freeze({
      id:'water',
      href:'guides/water-for-dogs-on-trail.html',
      label:'Water for dogs on alpine trails',
      summary:'Plan the full supply when reliable water is not confirmed.',
    }),
    paws:Object.freeze({
      id:'paws',
      href:'guides/paw-protection.html',
      label:'Protecting paw pads on rocky terrain',
      summary:'Prepare for rough surfaces and recognise pad damage.',
    }),
    exposure:Object.freeze({
      id:'exposure',
      href:'safety-guide.html',
      label:'Dog hiking safety guide',
      summary:'Review turn-back decisions and emergency preparation.',
    }),
  });

  function guideId(code){
    code = String(code || '');
    if(/^(?:trail\.(?:heat|shade)|conditions\.heat)\./.test(code)) return 'heat';
    if(/^trail\.water\./.test(code)) return 'water';
    if(/^trail\.(?:surface-hazards|terrain|descent)\./.test(code)) return 'paws';
    if(/^trail\.exposure\./.test(code)) return 'exposure';
    return null;
  }

  function select(recommendation, maximum){
    const candidates = []
      .concat(Array.isArray(recommendation && recommendation.hardStops)
        ? recommendation.hardStops : [])
      .concat(Array.isArray(recommendation && recommendation.cautions)
        ? recommendation.cautions : []);
    const selected = [];
    const seen = new Set();
    const cap = Number.isFinite(maximum) ? Math.max(0, maximum) : 2;
    for(const caution of candidates){
      const id = guideId(caution && caution.code);
      if(!id || seen.has(id)) continue;
      seen.add(id);
      selected.push(GUIDES[id]);
      if(selected.length >= cap) break;
    }
    return selected;
  }

  return Object.freeze({ GUIDES, select });
});

