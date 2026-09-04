const decision = require('./recommendation-decision');

const recommendation = {
  score:72,
  category:'possible-with-cautions',
  confidence:'medium',
  scoringVersion:'1.3.0',
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
    expect(result.scoringVersion).toBe('1.3.0');
  });

  test('the four shown reasons keep the ones specific to this dog', () => {
    // Engine emission order, which puts every behaviour reason last.
    const result = decision.present({
      ...recommendation,
      positiveReasons:[
        { code:'trail.terrain.within-tolerance', message:'Terrain is fine.' },
        { code:'trail.distance.within-range', message:'Distance is within range.' },
        { code:'trail.ascent.within-range', message:'Ascent is within range.' },
        { code:'trail.exposure.none-known', message:'No exposed section.' },
        { code:'trail.shade.good', message:'Substantial shade.' },
        { code:'trail.dog-access.allowed', message:'Dogs are allowed.' },
        { code:'trail.water.reviewed', message:'Water is available at 2 reviewed points.' },
        { code:'trail.sightlines.open', message:'Open sightlines keep this dog visible.' },
        { code:'trail.duration.within-preference', message:'Fits the preferred walk length.' },
      ],
    }, { dogName:'Eddie' });

    expect(result.reasons).toEqual([
      'Distance is within range.',
      'Fits the preferred walk length.',
      'Water is available at 2 reviewed points.',
      'Open sightlines keep this dog visible.',
    ]);
  });

  test('a positioned advisory is not crowded out by generic cautions', () => {
    const result = decision.present({
      ...recommendation,
      cautions:[
        { code:'trail.descent.joint-load', message:'Sustained descent.' },
        { code:'trail.shade.low', message:'Shade is limited.' },
        { code:'trail.heat.moderate', message:'Moderate heat risk.' },
        { code:'conditions.heat.moderate', message:'Moderate heat load today.' },
        { code:'trail.wildlife.chase-risk', message:'Wildlife is active here.' },
        { code:'segment.leash-recommended.livestock.2.1-3.4',
          message:'Lead recommended between kilometres 2.1 and 3.4 — open grazing pasture.' },
      ],
    }, { dogName:'Eddie' });

    expect(result.cautions).toContain(
      'Lead recommended between kilometres 2.1 and 3.4 — open grazing pasture.');
    expect(result.cautions).toContain('Wildlife is active here.');
  });

  test('a hard stop always leads the cautions', () => {
    const result = decision.present({
      ...recommendation,
      hardStops:[{ code:'trail.dog-access.prohibited', message:'Dogs are prohibited.' }],
      cautions:[
        { code:'segment.leash-recommended.livestock.2.1-3.4', message:'Lead recommended.' },
      ],
    }, { dogName:'Eddie' });

    expect(result.cautions[0]).toBe('Dogs are prohibited.');
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
