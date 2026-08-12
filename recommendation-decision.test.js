const decision = require('./recommendation-decision');

const recommendation = {
  score:72,
  category:'possible-with-cautions',
  confidence:'medium',
  scoringVersion:'1.1.0',
  evidenceTier:'route-audited',
  positiveReasons:[{ message:'Distance is within range.' }],
  cautions:[{ message:'Shade is limited.' }],
  hardStops:[],
  unknowns:[
    { message:'Current conditions are unavailable.' },
    { message:'Access evidence is not verified.' },
  ],
};

describe('canonical recommendation decision presentation', () => {
  test('names the active dog and preserves canonical sections', () => {
    const result = decision.present(recommendation, { dogName:'Eddie' });

    expect(result.conclusion).toBe('Possible with cautions');
    expect(result.contextLabel).toBe('Recommendation for Eddie');
    expect(result.heroSummary).toBe('Possible with cautions for Eddie.');
    expect(result.reasons).toEqual(['Distance is within range.']);
    expect(result.cautions).toEqual(['Shade is limited.']);
    expect(result.unknowns).toHaveLength(2);
    expect(result.scoringVersion).toBe('1.1.0');
  });

  test('labels guest output as unpersonalized', () => {
    const result = decision.present(recommendation);

    expect(result.contextLabel).toBe('Unpersonalized planning view');
    expect(result.dogName).toBeNull();
    expect(result.heroSummary).toContain('unpersonalized');
  });

  test('translates conclusions and coded reasons without changing the score', () => {
    const translations = {
      'recommendation.category.possible-with-cautions':'Possibile con precauzioni',
      'recommendation.context.dog':'Raccomandazione per {name}',
      'recommendation.hero.dog':'{conclusion} per {name}.',
      'recommendation.confidence.medium':'Dati parzialmente verificati',
      'recommendation.reason.trail.distance.within-range':'Il percorso di {distance} km è adatto.',
    };
    const t = (key, vars) => {
      let value = translations[key] || key;
      for(const name of Object.keys(vars || {})) value = value.split(`{${name}}`).join(vars[name]);
      return value;
    };
    const result = decision.present({
      ...recommendation,
      positiveReasons:[{
        code:'trail.distance.within-range',
        message:'The 7.5 km route is within this dog’s effective range.',
        vars:{ distance:7.5 },
      }],
    }, { dogName:'Eddie', translate:t });

    expect(result.score).toBe(72);
    expect(result.conclusion).toBe('Possibile con precauzioni');
    expect(result.contextLabel).toBe('Raccomandazione per Eddie');
    expect(result.heroSummary).toBe('Possibile con precauzioni per Eddie.');
    expect(result.reasons).toEqual(['Il percorso di 7.5 km è adatto.']);
    expect(result.confidenceLabel).toBe('Dati parzialmente verificati');
  });

  test('hard stops appear before ordinary cautions', () => {
    const result = decision.present({
      ...recommendation,
      category:'not-recommended',
      hardStops:[{ message:'Dogs are prohibited.' }],
    });

    expect(result.conclusion).toBe('Not recommended');
    expect(result.tone).toBe('stop');
    expect(result.cautions).toEqual(['Dogs are prohibited.', 'Shade is limited.']);
  });

  test('unknown overflow remains explicit', () => {
    const result = decision.present({
      ...recommendation,
      unknowns:Array.from({ length:8 }, (_, index) => ({ message:`Unknown ${index + 1}` })),
    });

    expect(result.unknowns).toHaveLength(5);
    expect(result.additionalUnknowns).toBe(3);
  });
});
