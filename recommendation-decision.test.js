const fs = require('fs');
const path = require('path');
const { requireAll } = require('./test-support/page-runtime');

// The homepage loads the vocabulary before this view, and so does the test:
// the words it renders are match-verdict.js's, not a copy of its own.
requireAll('index.html', ['match-verdict.js']);
const decision = require('./recommendation-decision');

const recommendation = {
  score:72,
  category:'possible-with-cautions',
  confidence:'medium',
  scoringVersion:'1.6.0',
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

    expect(result.conclusion).toBe('Good with care');
    expect(result.contextLabel).toBe('Recommendation for Eddie');
    expect(result.heroSummary).toBe('Good with care for Eddie.');
    expect(result.reasons).toEqual(['Distance is within range.']);
    expect(result.cautions).toEqual(['Shade is limited.']);
    expect(result.unknowns).toHaveLength(2);
    expect(result.scoringVersion).toBe('1.6.0');
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
          message:'Lead recommended between kilometres 2.1 and 3.4, open grazing pasture.' },
      ],
    }, { dogName:'Eddie' });

    expect(result.cautions).toContain(
      'Lead recommended between kilometres 2.1 and 3.4, open grazing pasture.');
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

  test('the breakdown is headed in the dog\'s name and is not truncated', () => {
    const factors = Array.from({ length: 9 }, (unused, index) => ({
      code:`f${index}`, message:`Factor number ${index} moved the score.`, impact:-(9 - index),
    }));

    const owner = decision.present({ ...recommendation, factors }, { dogName:'Nina' });
    expect(owner.breakdownFor).toBe('Nina');
    // The card's summary lists cap at four; the breakdown must not, because
    // the criterion is that it lists exactly the factors the score used.
    expect(owner.breakdown).toHaveLength(9);
    expect(owner.breakdown[0].impact).toBe(-9);
    expect(owner.breakdown.every(entry => typeof entry.message === 'string')).toBe(true);
  });

  test('a guest sees the same breakdown headed for a medium dog', () => {
    const guest = decision.present({
      ...recommendation,
      factors:[{ code:'f', message:'Distance is within range.', impact:0 }],
    });

    expect(guest.breakdownFor).toBe('a medium dog');
    expect(guest.breakdown).toHaveLength(1);
  });

  describe('P0-3 the before/after first-run moment', () => {
    const guest = { score:78, forName:'a medium dog' };

    test('states the move in both scores and both names', () => {
      expect(decision.firstRunCallout(guest, { score:61, forName:'Nina' }))
        .toBe('Was 78% for a medium dog · now 61% for Nina. See why below.');
    });

    test('a move of two points or less says nothing at all', () => {
      // Anything else invents drama the score does not support, and a banner
      // reading "same score" says only that nothing happened. The caller drops
      // the whole paragraph on null, so no empty box is left behind.
      expect(decision.firstRunCallout(guest, { score:76, forName:'Nina' })).toBeNull();
      expect(decision.firstRunCallout(guest, { score:80, forName:'Nina' })).toBeNull();
      expect(decision.firstRunCallout(guest, { score:78, forName:'Nina' })).toBeNull();
      // Three points is a move, and still gets said.
      expect(decision.firstRunCallout(guest, { score:81, forName:'Nina' }))
        .toMatch(/^Was 78% /);
      expect(decision.SAME_SCORE_TOLERANCE).toBe(2);
    });

    test('nothing anywhere still says "same score"', () => {
      // The string is gone, not merely unreachable from one branch.
      const source = fs.readFileSync(path.join(__dirname, 'recommendation-decision.js'), 'utf8');
      expect(source).not.toContain('Same score for');
      expect(source).not.toContain('recommendation.firstRun.same');
    });

    test('says nothing when there is nothing to compare', () => {
      expect(decision.firstRunCallout(null, { score:61, forName:'Nina' })).toBeNull();
      // Re-rendering for the same dog is not a first run.
      expect(decision.firstRunCallout({ score:61, forName:'Nina' }, { score:55, forName:'Nina' })).toBeNull();
      expect(decision.firstRunCallout(guest, { score:null, forName:'Nina' })).toBeNull();
    });
  });

  test('labels guest output as unpersonalized', () => {
    const result = decision.present(recommendation);

    expect(result.contextLabel).toBe('Unpersonalized planning view');
    expect(result.dogName).toBeNull();
    expect(result.heroSummary).toContain('unpersonalized');
  });

  test('translates conclusions and coded reasons without changing the score', () => {
    const translations = {
      'recommendation.category.possible-with-cautions':'Con attenzione',
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
    expect(result.conclusion).toBe('Con attenzione');
    expect(result.contextLabel).toBe('Raccomandazione per Eddie');
    expect(result.heroSummary).toBe('Con attenzione per Eddie.');
    expect(result.reasons).toEqual(['Il percorso di 7.5 km è adatto.']);
    expect(result.confidenceLabel).toBe('Dati parzialmente verificati');
  });

  test('hard stops appear before ordinary cautions', () => {
    const result = decision.present({
      ...recommendation,
      category:'not-recommended',
      hardStops:[{ message:'Dogs are prohibited.' }],
    });

    expect(result.conclusion).toBe('Low match');
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

describe('the trail page breakdown, one row per factor', () => {
  // It used to list the costs, then "Fine for Teo: the terrain, the 9.6 km
  // distance, ..." as one line, and a positive with no short form stood alone
  // under a bare "fine" chip. Each factor is now a row: what it is, what this
  // walk has, and what that meant.
  const factors = [
    { code:'trail.season.inside', message:'In season.', impact:0, vars:{ month:11 } },
    { code:'trail.terrain.within-tolerance', message:'Terrain is fine.', impact:0, vars:{ terrain:1, tolerance:2, steepest:14 } },
    { code:'trail.distance.within-range', message:'Distance.', impact:0, vars:{ distance:9.6 } },
    { code:'trail.ascent.above-range', message:'Too much climb.', impact:-8, vars:{ ascent:820, range:600 } },
    { code:'trail.water.reviewed', messageKey:'trail.water.reviewed.many', message:'Water.', impact:0, vars:{ count:2 } },
    { code:'trail.exposure.present', message:'Drops.', impact:-30 },
  ];
  const view = decision.present({
    ...recommendation, category:'possible-with-cautions', score:62, factors,
    positiveReasons:factors.filter(f => f.impact === 0).map(f => ({ code:f.code, message:f.message, vars:f.vars })),
    cautions:factors.filter(f => f.impact < 0),
  }, { dogName:'Teo' });

  test('costs lead, the larger first, then what fits', () => {
    expect(view.factorRows.map(row => [row.topic, row.status])).toEqual([
      ['Drops', 'Lowers score'],
      ['Climb', 'Lowers score'],
      ['Season', 'Fits'],
      ['Steepness', 'Fits'],
      ['Distance', 'Fits'],
      ['Water', 'Fits'],
    ]);
  });

  test('the pills say it in words; the points ride along for the closed list', () => {
    expect(view.factorRows.some(row => /\d/.test(row.status))).toBe(false);
    expect(view.factorRows.map(row => [row.topic, row.points])).toEqual([
      ['Drops', '−30'],
      ['Climb', '−8'],
      ['Season', '0'],
      ['Steepness', '0'],
      ['Distance', '0'],
      ['Water', '0'],
    ]);
  });

  test('a row that fits states the fact, not a verdict', () => {
    const detail = topic => view.factorRows.find(row => row.topic === topic).detail;
    expect(detail('Distance')).toBe('9.6 km');
    expect(detail('Water')).toBe('At 2 points on the way');
    expect(detail('Season')).toBe('In season this month');
    expect(detail('Steepness')).toBe('Moderately steep, steepest stretch about 14%');
    // Nothing is labelled with a bare "fine" any more.
    expect(view.factorRows.some(row => /^fine$/i.test(row.status))).toBe(false);
  });

  test('a cost row keeps its plain sentence', () => {
    expect(view.factorRows.find(row => row.topic === 'Climb').detail).toBe('820 m of climbing is a lot for Teo.');
  });

  test('what the score could not look at is kept apart from the rows', () => {
    const unknown = decision.present({
      ...recommendation, factors:[],
      unknowns:[{ code:'trail.dog-access.unknown', message:'Unknown.' }, { code:'dog.weight.unknown', message:'Weight.' }],
    }, { dogName:'Teo' });
    expect(unknown.factorRows).toEqual([]);
    // A dog gap becomes the profile prompt instead, so it is not listed here.
    expect(unknown.notChecked).toEqual(['We haven’t found this area’s dog rules yet. Ask the local tourist office before you go.']);
  });
});

describe('steepness said in words, never as a grade', () => {
  const steep = vars => decision.present({
    ...recommendation,
    factors:[{ code:'trail.terrain.above-tolerance', message:'Terrain is above tolerance (2 versus 0).', impact:-20, vars }],
    cautions:[{ code:'trail.terrain.above-tolerance', message:'x', vars }],
  }, { dogName:'Teo' });

  test('with the figure when the profile gives one', () => {
    const view = steep({ terrain:2, tolerance:0, steepest:22 });
    expect(view.factorRows[0].detail)
      .toBe('Steeper than Teo likes, up to 22% in places.');
    expect(view.cardCautions[0]).toBe(view.factorRows[0].detail);
  });

  test('and without it when there is none', () => {
    expect(steep({ terrain:2, tolerance:1, steepest:null }).factorRows[0].detail)
      .toBe('Steeper than Teo likes.');
  });

  test('no grade or tolerance number reaches the reader', () => {
    const view = steep({ terrain:2, tolerance:1, steepest:20 });
    expect(JSON.stringify(view.factorRows.map(({ topic, detail, status }) => [topic, detail, status]))).not.toMatch(/grade|tolerance/i);
  });
});

describe('the homepage card verdict line', () => {
  const positives = [
    { code:'trail.exposure.none-known', message:'No drops.' },
    { code:'trail.water.reviewed', message:'Water.', vars:{ count:1 } },
    { code:'trail.ascent.within-range', message:'Climb.', vars:{ ascent:170 } },
    { code:'trail.distance.within-range', message:'Distance.', vars:{ distance:9.6 } },
  ];
  const card = category => decision.present({ ...recommendation, category, positiveReasons:positives }, { dogName:'Teo' }).cardVerdict;

  test('three facts an owner plans around, in a fixed order', () => {
    expect(card('strong-option')).toEqual({ lead:'Good for Teo', facts:'9.6 km, a gentle 170 m climb and water on the way' });
  });

  test('good with care says so', () => {
    expect(card('possible-with-cautions').lead).toBe('Mostly fine for Teo');
  });

  test('a low match has no verdict line, only its reasons', () => {
    expect(card('not-recommended')).toBeNull();
  });

  test('nothing to say means no line', () => {
    expect(decision.present({ ...recommendation, category:'strong-option', positiveReasons:[] }, { dogName:'Teo' }).cardVerdict).toBeNull();
  });
});

describe('the comparison page keeps its "what fits" phrases', () => {
  test('in the engine order', () => {
    const factors = [
      { code:'trail.terrain.within-tolerance', message:'T.', impact:0 },
      { code:'trail.distance.within-range', message:'D.', impact:0, vars:{ distance:'3.6' } },
    ];
    const view = decision.present({ ...recommendation, factors, positiveReasons:factors }, { dogName:'Teo' });
    expect(view.fine).toEqual(['the steepness', 'the 3.6 km distance']);
  });
});
