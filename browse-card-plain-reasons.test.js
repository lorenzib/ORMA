/**
 * "What to know today" on the homepage card says the engine's cautions in
 * plain words (recommendation-decision.js CARD_SENTENCES), the way #1304
 * rewrote the safety guides. Laghi di Fusine for Teo was the example: grade
 * and tolerance numbers, and three route cautions in one sentence.
 */
const decision = require('./recommendation-decision.js');

const FUSINE_HAZARDS = [
  'Boardwalks and roots along the lakeshore are slippery when wet',
  'Busy in summer and at weekends: keep your dog close on the narrow shore paths',
  'A protected Natura 2000 site: stay on the marked paths in the Scichizza bog',
];

function fusine(hazards = FUSINE_HAZARDS){
  return {
    category:'not-recommended',
    cautions:[
      { code:'trail.terrain.above-tolerance', message:'Terrain is above this dog’s effective tolerance (2 versus 1).',
        vars:{ terrain:2, tolerance:1 } },
      { code:'trail.surface-hazards.present',
        messageKey:hazards.length === 1 ? 'trail.surface-hazards.present.one' : 'trail.surface-hazards.present.many',
        message:`Recorded route cautions: ${hazards.join('; ')}.`,
        vars:{ count:hazards.length, hazards:hazards.join('; '), first:hazards[0] } },
      { code:'trail.water.none-reviewed', message:'No confirmed water on the route, so carry it all.' },
    ],
    unknowns:[
      { code:'trail.exposure.unknown', message:'Exposure and drop-offs have not been established.' },
    ],
  };
}

// The page's i18n, reduced to what the card reads: phrases, and the trail's
// own text where it has been loaded.
function useLanguage(lang, phrases = {}, trailText = {}){
  window.DoloPawsI18n = {
    lang,
    phrase:(text, vars) => {
      let s = lang === 'it' && phrases[text] ? phrases[text] : text;
      for(const k in vars || {}) s = s.split(`{${k}}`).join(vars[k]);
      return s;
    },
    trailText:text => (lang === 'it' && trailText[text]) || text,
  };
}

afterEach(() => { delete window.DoloPawsI18n; });

describe('the homepage card says its cautions plainly', () => {
  test('Fusine for Teo: no grade or tolerance, and one caution quoted', () => {
    useLanguage('en');
    const view = decision.present(fusine(), { dogName:'Teo' });
    expect(view.cardCautions).toEqual([
      'Steeper than Teo likes.',
      'Boardwalks and roots along the lakeshore are slippery when wet.',
      'We know of no water on the way. Bring all Teo needs.',
    ]);
    expect(view.cardTrailUnknowns).toEqual(['We don’t know yet if there are steep drops.']);
  });

  test('the trail page keeps the engine’s full sentences', () => {
    useLanguage('en');
    const view = decision.present(fusine(), { dogName:'Teo' });
    expect(view.cautions[1]).toBe(`Recorded route cautions: ${FUSINE_HAZARDS.join('; ')}.`);
  });

  test('the card quotes the first caution and leaves the count to the trail page', () => {
    useLanguage('en');
    expect(decision.present(fusine(FUSINE_HAZARDS.slice(0, 1)), { dogName:'Teo' }).cardCautions[1])
      .toBe('Boardwalks and roots along the lakeshore are slippery when wet.');
    expect(decision.present(fusine(FUSINE_HAZARDS.slice(0, 2)), { dogName:'Teo' }).cardCautions[1])
      .toBe('Boardwalks and roots along the lakeshore are slippery when wet.');
  });

  test('an Italian card never quotes a caution it only has in English', () => {
    useLanguage('it', {
      'There are {count} things to watch for on this route. The trail page lists them.':
        'Su questo percorso ci sono {count} cose a cui fare attenzione: le trovi nella pagina del sentiero.',
    });
    expect(decision.present(fusine(), { dogName:'Teo' }).cardCautions[1])
      .toBe('Su questo percorso ci sono 3 cose a cui fare attenzione: le trovi nella pagina del sentiero.');
  });

  test('an Italian card quotes the caution once its Italian is loaded', () => {
    useLanguage('it', {},
      { [FUSINE_HAZARDS[0]]:'Passerelle e radici lungo la riva sono scivolose quando sono bagnate' });
    expect(decision.present(fusine(), { dogName:'Teo' }).cardCautions[1])
      .toBe('Passerelle e radici lungo la riva sono scivolose quando sono bagnate.');
  });

  test('every card sentence has an Italian phrase', () => {
    const fs = require('fs');
    const source = fs.readFileSync(require.resolve('./recommendation-decision.js'), 'utf8');
    const start = source.indexOf('const CARD_SENTENCES');
    const end = source.indexOf('function cardMessage(');
    const chipStart = source.indexOf('const FIT_CHIPS');
    const chipEnd = source.indexOf('function fitChip(');
    const english = [...source.slice(start, end).matchAll(/tx\('([^']+)'\)/g)]
      .concat([...source.slice(chipStart, chipEnd).matchAll(/tx\('([^']+)'\)/g)]).map(m => m[1]);
    expect(english.length).toBeGreaterThan(35);
    require('./i18n-phrases-it.js');
    const missing = english.filter(text => !window.ORMA_PHRASES_IT[text]);
    expect(missing).toEqual([]);
  });
});

describe('the trail page breakdown says the same things plainly', () => {
  const engine = require('./scoring/recommendation-v1.js');
  const verified = Object.fromEntries(['route', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access']
    .map(key => [key, 'verified']));
  function sorapis(hazards){
    return engine.calculateRecommendation({
      dog:{ fitness:'moderate', ageYears:4, weightKg:14 },
      effectiveLimits:{ terrainRank:1 },
      trail:{
        metrics:{ distanceKm:8.9, ascentM:662, descentM:662 },
        suitability:{ terrainRank:2, exposure:true, heatRisk:'low', shadePercent:60,
          surfaceHazards:hazards, dogAccess:{ status:'allowed' } },
        verification:{ categories:verified },
      },
    });
  }
  const rows = view => view.factorRows.map(row => row.detail);

  test('no grade or tolerance, and every caution kept under a plain heading', () => {
    useLanguage('en');
    const recommendation = sorapis(['Steep rock steps where a dog may need a hand', 'A short, fairly exposed ledge with no cable']);
    const view = decision.present(recommendation, { dogName:'Teo' });
    expect(rows(view)).toEqual(expect.arrayContaining([
      'Parts of the path run beside steep drops.',
      'Steeper than Teo likes.',
      'Steep rock steps where a dog may need a hand; A short, fairly exposed ledge with no cable.',
    ]));
    expect(rows(view).join(' ')).not.toMatch(/grade|tolerance|Recorded route/);
    // The engine's own sentence is still there for anything that audits it.
    expect(view.breakdown.length).toBe(recommendation.factors.filter(f => f.code !== 'score.floor').length);
    expect(recommendation.factors.find(f => f.code === 'trail.terrain.above-tolerance').message).toMatch(/tolerance/);
  });

  test('a single caution is said on its own', () => {
    useLanguage('en');
    const view = decision.present(sorapis(['Rocky steps near the ridge']), { dogName:'Teo' });
    expect(rows(view)).toContain('Rocky steps near the ridge.');
  });

  test('the floor note says why the score stops, not that it rests at its floor', () => {
    useLanguage('en');
    const view = decision.present({
      category:'not-recommended',
      factors:[{ code:'score.floor', impact:5, message:'The demands above already exceed what this dog can comfortably take, so the score rests at its floor.' }],
    }, { dogName:'Teo' });
    expect(view.breakdownNote).toBe('This walk asks too much of Teo, so the score stays at its lowest.');
  });
});

describe('the trail page says it short', () => {
  const engine = require('./scoring/recommendation-v1.js');
  const verified = Object.fromEntries(['route', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access']
    .map(key => [key, 'verified']));
  const ortisei = access => engine.calculateRecommendation({
    dog:{ fitness:'moderate', ageYears:4, weightKg:14 },
    effectiveLimits:{ terrainRank:1 },
    trail:{
      metrics:{ distanceKm:6, ascentM:330, descentM:330 },
      suitability:{ terrainRank:2, exposure:false, heatRisk:'low', shadePercent:60,
        surfaceHazards:['Forest path with roots and a steady climb', 'Village streets in Ortisei: keep your dog close'],
        dogAccess:access },
      verification:{ categories:verified },
    },
  });

  test('reasons are what lowers the score; what fits becomes chips', () => {
    useLanguage('en');
    const view = decision.present(ortisei({ status:'allowed' }), { dogName:'Teo' });
    expect(view.shortReasons.map(reason => reason.text)).toEqual([
      'Steeper than Teo likes.',
      'Forest path with roots and a steady climb; Village streets in Ortisei: keep your dog close.',
      // The fixture records no water, which lowers the score too.
      'We know of no water on the way. Bring all Teo needs.',
    ]);
    expect(view.fitChips).toEqual(expect.arrayContaining(['6 km', '330 m climb', 'No drops']));
    // "Dogs allowed" says nothing on a site where every walk takes dogs.
    expect(view.fitChips).not.toContain('Dogs allowed');
    expect(view.fitChips).not.toContain('Dog rules');
    // Every factor is still listed for the points link.
    expect(view.factorRows.length).toBe(view.breakdown.length);
  });

  test('dog rules are said only when they restrict the walk', () => {
    useLanguage('en');
    const said = view => view.shortReasons.map(reason => reason.text).concat(view.fitChips).join(' | ');
    // Unknown: nothing.
    expect(said(decision.present(ortisei({ status:'unknown' }), { dogName:'Teo' }))).not.toMatch(/dog rules|tourist office|Dogs allowed/i);
    // A lead: one chip.
    expect(decision.present(ortisei({ status:'leash-required' }), { dogName:'Teo' }).fitChips).toContain('Dogs on a lead');
    // A ban: a reason, and the walk is stopped.
    const banned = decision.present(ortisei({ status:'prohibited' }), { dogName:'Teo' });
    expect(banned.shortReasons[0].tone).toBe('stop');
  });
});
