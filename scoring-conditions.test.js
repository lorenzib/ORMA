'use strict';

const fs = require('fs');
const path = require('path');
const shared = require('./scoring-conditions');

const TRAIL = { id:'tre-cime', lat:46.61, lng:12.29 };
const OTHER = { id:'lago-braies', lat:46.69, lng:12.08 };
const TODAY = { status:'known', heatRisk:'high' };

describe('one answer for what the weather is doing', () => {
  afterEach(() => {
    shared.reset();
    delete global.window.DoloPawsHomeConditions;
  });
  beforeAll(() => { global.window = global.window || {}; });

  test('an area forecast answers for any trail', () => {
    global.window.DoloPawsHomeConditions = { forTrail: trail => ({ status:'known', of:trail.id }) };
    expect(shared.forTrail(TRAIL)).toEqual({ status:'known', of:'tre-cime' });
    expect(shared.forTrail(OTHER)).toEqual({ status:'known', of:'lago-braies' });
  });

  // The area forecast is computed per trail, altitude included, so it wins over
  // a page that fetched one forecast for one trail.
  test('the area forecast wins over a single declared one', () => {
    global.window.DoloPawsHomeConditions = { forTrail: () => ({ status:'known', from:'area' }) };
    shared.declareForTrail('tre-cime', { status:'known', from:'page' });
    expect(shared.forTrail(TRAIL).from).toBe('area');
  });

  test('a page that fetched one forecast answers for that trail', () => {
    shared.declareForTrail('tre-cime', TODAY);
    expect(shared.forTrail(TRAIL)).toEqual(TODAY);
  });

  // The whole reason the declaration carries a trail id. A trail page holds one
  // valley's weather; the nearby picks beside it are different trails at
  // different altitudes, and handing them this forecast is a wrong number
  // rather than an absent one.
  test('and never hands it to a different trail', () => {
    shared.declareForTrail('tre-cime', TODAY);
    expect(shared.forTrail(OTHER)).toBeUndefined();
  });

  test('no source at all is undefined, which the engine reports honestly', () => {
    expect(shared.forTrail(TRAIL)).toBeUndefined();
  });

  test('an area source that knows nothing yet falls through to the page', () => {
    global.window.DoloPawsHomeConditions = { forTrail: () => undefined };
    shared.declareForTrail('tre-cime', TODAY);
    expect(shared.forTrail(TRAIL)).toEqual(TODAY);
  });

  test('a trail with no id cannot match a declaration', () => {
    shared.declareForTrail('tre-cime', TODAY);
    expect(shared.forTrail({ lat:46.6, lng:12.3 })).toBeUndefined();
  });
});

// The regression this exists to prevent: a screen that scores a dog against a
// trail without asking what the day is doing. Those screens disagreed with the
// ones that did by a median of 10 points and as much as 25, and in some cases
// by a whole verdict word. Asserted against the sources because the surfaces
// are spread across seven files and two pages, and the next one added is the
// one that forgets.
describe('every screen that scores a dog asks', () => {
  const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
  const SURFACES = [
    ['script.js', 'liConditionsFor'],
    ['homepage-search.js', 'conditionsFor'],
    ['trail-blueprint.js', 'conditionsForScoring'],
    ['trail.js', 'ORMAScoringConditions'],
    ['saved.html', 'ORMAScoringConditions'],
    ['browse-trails.html', 'ORMAScoringConditions'],
    ['collections-page.js', 'ORMAScoringConditions'],
    ['comparison-model.js', 'ORMAScoringConditions'],
    ['hike-mode.js', 'ORMAScoringConditions'],
  ];

  test.each(SURFACES)('%s passes conditions to the engine', (file, marker) => {
    expect(read(file)).toContain(marker);
  });

  // Two call sites on one page used to disagree: the ring included the day and
  // the "Right for {dog}?" card did not, on the same trail for the same dog.
  test('the trail page scores its three match numbers the same way', () => {
    const source = read('trail-blueprint.js');
    expect(source).toContain('conditionsForScoring(t)');       // the dog card
    expect(source).toContain('conditionsForScoring(o)');       // the nearby picks
    expect(source).toContain('conditionsForScoring()');        // the ring
    expect(source).toContain('declareForTrail(t.id, conditions)');
  });

  // Reaching past the accessor for the area *card* is fine -- that is the
  // headline over the list, not a score. What must not come back is a scoring
  // helper reading a snapshot source directly, which is how the two families
  // of screens drifted apart in the first place.
  test('no scoring helper reaches past the accessor to a snapshot source', () => {
    const helpers = [
      ['script.js', /function liConditionsFor\(trail\)\{[\s\S]*?\n\}/],
      ['homepage-search.js', /function conditionsFor\(t\) \{[\s\S]*?\n  \}/],
      ['trail-blueprint.js', /function conditionsForScoring\(subject\) \{[\s\S]*?\n    \}/],
    ];
    for(const [file, pattern] of helpers){
      const body = read(file).match(pattern);
      expect(body).not.toBeNull();
      expect(body[0]).toContain('ORMAScoringConditions');
      expect(body[0]).not.toContain('DoloPawsHomeConditions');
      expect(body[0]).not.toContain('DoloPawsCurrentConditions');
    }
  });

  test('the accessor is published, or every page that loads it breaks', () => {
    const manifest = JSON.parse(read('pages-public-manifest.json'));
    expect(manifest.files).toContain('scoring-conditions.js');
  });

  test('and ships in the trail page bundle', () => {
    expect(read('scripts/build-trail-page-bundle.js')).toContain("'scoring-conditions.js'");
    expect(read('trail-app.bundle.js')).toContain('ORMAScoringConditions');
  });
});
