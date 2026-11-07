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
  test('Fusine for Teo: no grade or tolerance, one caution quoted and the rest counted', () => {
    useLanguage('en');
    const view = decision.present(fusine(), { dogName:'Teo' });
    expect(view.cardCautions).toEqual([
      'The path is rougher than Teo is used to.',
      'Boardwalks and roots along the lakeshore are slippery when wet. The trail page has 2 more.',
      'We know of no water on the way. Bring all Teo needs.',
    ]);
    expect(view.cardTrailUnknowns).toEqual(['We don’t know yet if there are steep drops.']);
  });

  test('the trail page keeps the engine’s full sentences', () => {
    useLanguage('en');
    const view = decision.present(fusine(), { dogName:'Teo' });
    expect(view.cautions[1]).toBe(`Recorded route cautions: ${FUSINE_HAZARDS.join('; ')}.`);
  });

  test('one caution is quoted alone, two say "one more"', () => {
    useLanguage('en');
    expect(decision.present(fusine(FUSINE_HAZARDS.slice(0, 1)), { dogName:'Teo' }).cardCautions[1])
      .toBe('Boardwalks and roots along the lakeshore are slippery when wet.');
    expect(decision.present(fusine(FUSINE_HAZARDS.slice(0, 2)), { dogName:'Teo' }).cardCautions[1])
      .toBe('Boardwalks and roots along the lakeshore are slippery when wet. The trail page has one more.');
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
    useLanguage('it', { 'The trail page has {more} more.':'La pagina del sentiero ne elenca altre {more}.' },
      { [FUSINE_HAZARDS[0]]:'Passerelle e radici lungo la riva sono scivolose quando sono bagnate' });
    expect(decision.present(fusine(), { dogName:'Teo' }).cardCautions[1])
      .toBe('Passerelle e radici lungo la riva sono scivolose quando sono bagnate. La pagina del sentiero ne elenca altre 2.');
  });

  test('every card sentence has an Italian phrase', () => {
    const fs = require('fs');
    const source = fs.readFileSync(require.resolve('./recommendation-decision.js'), 'utf8');
    const start = source.indexOf('const CARD_SENTENCES');
    const end = source.indexOf('function cardMessage(');
    const english = [...source.slice(start, end).matchAll(/tx\('([^']+)'\)/g)].map(m => m[1]);
    expect(english.length).toBeGreaterThan(20);
    require('./i18n-phrases-it.js');
    const missing = english.filter(text => !window.ORMA_PHRASES_IT[text]);
    expect(missing).toEqual([]);
  });
});
