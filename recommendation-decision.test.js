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
