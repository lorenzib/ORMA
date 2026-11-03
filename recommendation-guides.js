(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsRecommendationGuides = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  // Label and summary are read when shown, so they come out in the page's language.
  const GUIDES = Object.freeze({
    heat:Object.freeze({
      id:'heat',
      href:'guides/heat-overheating.html',
      get label(){ return tx('Recognising overheating early'); },
      get summary(){ return tx('Know the early signs and when to stop.'); },
    }),
    water:Object.freeze({
      id:'water',
      href:'guides/water-for-dogs-on-trail.html',
      get label(){ return tx('Water for dogs on alpine trails'); },
      get summary(){ return tx('Plan the full supply when reliable water is not confirmed.'); },
    }),
    paws:Object.freeze({
      id:'paws',
      href:'guides/paw-protection.html',
      get label(){ return tx('Looking after paw pads'); },
      get summary(){ return tx('Rough ground, hot tarmac and how to spot pad damage.'); },
    }),
    exposure:Object.freeze({
      id:'exposure',
      href:'safety-guide.html',
      get label(){ return tx('Dog hiking safety guide'); },
      get summary(){ return tx('Review turn-back decisions and emergency preparation.'); },
    }),
    livestock:Object.freeze({
      id:'livestock',
      href:'guides/livestock-guard-dogs.html',
      get label(){ return tx('Livestock and guardian dogs'); },
      get summary(){ return tx('Cross grazed pasture calmly and avoid confrontations.'); },
    }),
    altitude:Object.freeze({
      id:'altitude',
      href:'guides/altitude-with-your-dog.html',
      get label(){ return tx('Hiking safely at altitude'); },
      get summary(){ return tx('Plan for thinner air, rapid weather changes and lingering snow.'); },
    }),
    lifts:Object.freeze({
      id:'lifts',
      href:'guides/dogs-on-cable-cars.html#chairlifts',
      get label(){ return tx('Lifts with your dog: open chairs and closed cabins'); },
      get summary(){ return tx('Why an open chairlift is a different risk from a gondola, and who can ride one.'); },
    }),
  });

  function guideId(code){
    code = String(code || '');
    if(/^(?:trail\.(?:heat|shade)|conditions\.heat)\./.test(code)) return 'heat';
    if(/^trail\.water\./.test(code)) return 'water';
    if(/^trail\.(?:surface-hazards|terrain|descent)\./.test(code)) return 'paws';
    if(/^trail\.exposure\./.test(code)) return 'exposure';
    if(/^trail\.livestock\./.test(code)) return 'livestock';
    if(/^trail\.altitude\./.test(code)) return 'altitude';
    if(/^trail\.lift\./.test(code)) return 'lifts';
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

  function selectIds(ids, maximum){
    const selected = [];
    const seen = new Set();
    const cap = Number.isFinite(maximum) ? Math.max(0, maximum) : 3;
    for(const id of Array.isArray(ids) ? ids : []){
      if(!GUIDES[id] || seen.has(id)) continue;
      seen.add(id);
      selected.push(GUIDES[id]);
      if(selected.length >= cap) break;
    }
    return selected;
  }

  return Object.freeze({ GUIDES, select, selectIds });
});
