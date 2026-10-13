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

    expect(result.conclusion).toBe('Possible with cautions');
    expect(result.contextLabel).toBe('Recommendation for Eddie');
    expect(result.heroSummary).toBe('Possible with cautions for Eddie.');
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

    test('a move of two points or less is not a move', () => {
      // Anything else invents drama the score does not support.
      expect(decision.firstRunCallout(guest, { score:76, forName:'Nina' }))
        .toBe('Same score for Nina as for a medium dog on this trail.');
      expect(decision.firstRunCallout(guest, { score:80, forName:'Nina' }))
        .toBe('Same score for Nina as for a medium dog on this trail.');
      // Three points is a move.
      expect(decision.firstRunCallout(guest, { score:81, forName:'Nina' }))
        .toMatch(/^Was 78% /);
      expect(decision.SAME_SCORE_TOLERANCE).toBe(2);
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

describe('the positives as sentences, for a card that lists them', () => {
  // The homepage shows "Why it fits Teo" beside "What to know today". The
  // second column has always been short sentences; this side used the
  // fold-line, which with seven positives is a seven-item fragment with no
  // verb in it. Same facts, same order -- a different voice.
  // A factor only folds when its code is also a positive reason, which is how
  // the engine emits them: the reason says it is good, the factor says what it
  // cost. Both are needed or nothing is classified positive at all.
  const positives = [
    { code:'trail.terrain.within-tolerance', message:'Terrain is fine.', impact:0 },
    { code:'trail.distance.within-range', message:'Distance is within range.', impact:0, vars:{ distance:'3.6' } },
    { code:'trail.ascent.within-range', message:'Ascent is within range.', impact:0, vars:{ ascent:'39' } },
  ];
  const withPositives = factors => ({
    ...recommendation, factors,
    positiveReasons:factors.map(factor => ({ code:factor.code, message:factor.message })),
  });

  test('every folded positive also has a whole sentence', () => {
    const view = decision.present(withPositives(positives), { dogName:'Teo' });
    expect(view.fits).toEqual([
      'The terrain is manageable.',
      'The 3.6 km distance is comfortable.',
      'The 39 m climb is gentle.',
    ]);
    // Same positives, same order, so the two lists cannot disagree about what
    // the score was made of.
    expect(view.fits).toHaveLength(view.fine.length);
  });

  test('no sentence names the dog, because the heading already does', () => {
    const view = decision.present(withPositives(positives), { dogName:'Teo' });
    expect(view.fits.some(sentence => sentence.includes('Teo'))).toBe(false);
  });

  test('a positive with a phrase but no sentence keeps the phrase', () => {
    // It must not vanish from a card that renders sentences. Both lists are
    // filled in the same pass so a new phrase cannot silently drop a reason.
    const view = decision.present(
      withPositives([{ code:'trail.terrain.within-tolerance', message:'Terrain is fine.', impact:0 }]),
      { dogName:'Teo' });
    expect(view.fits).toHaveLength(view.fine.length);
  });

  test('a mapped absence stays a recorded absence', () => {
    // "No surface hazards are recorded" is not "there are no surface hazards".
    // Mapped absence of a hazard is never, by itself, evidence it is absent,
    // and turning a phrase into a sentence must not upgrade the claim.
    const view = decision.present(withPositives([
      { code:'trail.surface-hazards.none-known', message:'No recorded hazards.', impact:0 },
      { code:'trail.exposure.none-known', message:'No exposed section.', impact:0 },
    ]), { dogName:'Teo' });
    expect(view.fits).toEqual(['No surface hazards are recorded.', 'No exposed sections are recorded.']);
  });

  test('fineLine is untouched, so the trail page reads as it did', () => {
    const view = decision.present(withPositives(positives), { dogName:'Teo' });
    expect(view.fineLine).toBe('Fine for Teo: the terrain, the 3.6 km distance and the 39 m climb.');
  });
});

describe('what the card leads with when it cannot show them all', () => {
  // The card shows four. The engine emits positives in calculation order and
  // every one costs nothing, so that order ranks nothing and the first four
  // were an arbitrary four. VERIFICATION.md states the rule this follows:
  // "a long or hot route with no mapped water is the single interaction that
  // most often harms dogs".
  const mixed = [
    { code:'trail.dog-access.leash', message:'Leashed.', impact:0 },
    { code:'trail.livestock.none', message:'No livestock.', impact:0 },
    { code:'trail.distance.within-range', message:'Distance.', impact:0, vars:{ distance:'3.6' } },
    { code:'trail.water.reviewed', message:'Water.', impact:0 },
    { code:'trail.exposure.none-known', message:'No exposure.', impact:0 },
    { code:'conditions.heat.low', message:'Cool.', impact:0 },
    { code:'trail.terrain.within-tolerance', message:'Terrain.', impact:0 },
  ];
  const withPositives = factors => ({
    ...recommendation, factors,
    positiveReasons:factors.map(factor => ({ code:factor.code, message:factor.message })),
  });

  test('water and heat come first, then what the owner asked for',()=>{
    const view = decision.present(withPositives(mixed), { dogName:'Teo' });
    expect(view.fits.slice(0, 4)).toEqual([
      'There is water on the route.',
      'Today is cool enough.',
      'The 3.6 km distance is comfortable.',
      'The terrain is manageable.',
    ]);
  });

  test('it orders, it never selects',()=>{
    // Nothing is added or dropped by ranking; the card does its own capping.
    const view = decision.present(withPositives(mixed), { dogName:'Teo' });
    expect([...view.fits].sort()).toEqual([
      'Dogs are allowed on a leash.',
      'No exposed sections are recorded.',
      'No livestock is recorded.',
      'The 3.6 km distance is comfortable.',
      'The terrain is manageable.',
      'There is water on the route.',
      'Today is cool enough.',
    ]);
  });

  test('ties keep the engine\'s own order',()=>{
    // Two in the same tier are not reshuffled against each other.
    const view = decision.present(withPositives([
      { code:'trail.shade.good', message:'Shade.', impact:0 },
      { code:'trail.water.reviewed', message:'Water.', impact:0 },
    ]), { dogName:'Teo' });
    expect(view.fits).toEqual(['There is good shade.', 'There is water on the route.']);
  });

  test('fine keeps the engine order, so the trail page sentence is unchanged',()=>{
    // fits is ordered for a card that shows four; fineLine is prose on the
    // trail page, and reordering it would rewrite that page's wording.
    const view = decision.present(withPositives(mixed), { dogName:'Teo' });
    expect(view.fine[0]).toBe('dog access on a leash');
    expect(view.fineLine.startsWith('Fine for Teo: dog access on a leash,')).toBe(true);
  });
});
