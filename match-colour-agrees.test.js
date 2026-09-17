const fs=require('fs');
const {STRONG_AT,POSSIBLE_AT,verdictFor}=require('./match-verdict.js');

// A trail scoring 62 read "Possible with cautions" in words and was coloured
// red on the map, because map-style.js kept its own boundary at 65 while the
// engine and the wording used 60. Colour is what a reader takes in first, so
// the two disagreeing is worse than either being wrong alone.
const mapStyle=fs.readFileSync('map-style.js','utf8');
const engine=fs.readFileSync('scoring/recommendation-v1.js','utf8');
const blueprint=fs.readFileSync('trail-blueprint.js','utf8');

const MATCH_GOOD=Number(/const MATCH_GOOD\s*=\s*(\d+)/.exec(mapStyle)[1]);
const MATCH_FAIR=Number(/const MATCH_FAIR\s*=\s*(\d+)/.exec(mapStyle)[1]);

describe('the colour and the word agree', () => {
  test('the map uses the same boundaries as the wording', () => {
    expect(MATCH_GOOD).toBe(STRONG_AT);
    expect(MATCH_FAIR).toBe(POSSIBLE_AT);
  });

  // The same disagreement, one surface further in: the trail page's match ring
  // drew green from 70 and amber from 50, so a score of 72 was a green ring
  // beside the words "Possible with cautions".
  test('the trail page ring takes its colour from the verdict, not its own bands', () => {
    expect(blueprint).toContain('window.OrmaMatchVerdict.verdictFor(recommendation)');
    expect(blueprint).not.toMatch(/score >= 70/);
    expect(blueprint).not.toMatch(/score >= 50/);
    // And the palette is the module's, not a second set of greens.
    expect(blueprint).not.toContain('#4a7c59');
    expect(blueprint).not.toContain('#c98a3e');
    expect(blueprint).not.toContain('#b2542e');
  });

  test('and both are the engine’s own', () => {
    expect(engine).toContain(`score >= ${STRONG_AT} ? 'strong-option'`);
    expect(engine).toContain(`score >= ${POSSIBLE_AT} ? 'possible-with-cautions'`);
  });

  // The score that was red while being called possible.
  test.each([
    [62,'Possible with cautions','fair'],
    [60,'Possible with cautions','fair'],
    [59,'Not recommended','poor'],
    [85,'Strong option','good'],
    [92,'Strong option','good'],
  ])('a score of %s is "%s" and coloured %s', (score,label,band) => {
    expect(verdictFor(score).label).toBe(label);
    expect(score>=MATCH_GOOD?'good':score>=MATCH_FAIR?'fair':'poor').toBe(band);
  });
});

describe('both maps look like the same product', () => {
  const browse=fs.readFileSync('browse-map.js','utf8');
  const home=fs.readFileSync('script.js','utf8');
  const page=fs.readFileSync('browse-trails.html','utf8');

  test('browse quiets its basemap, as the homepage always did', () => {
    expect(browse).toContain('ORMAMapStyle.quietBasemap(map)');
    expect(home).toContain('quietBasemap');
  });

  test('the cartography is loaded before the map that uses it', () => {
    expect(page.indexOf('map-style.js')).toBeLessThan(page.indexOf('browse-map.js'));
  });

  test('neither map re-inlines a colour ramp', () => {
    [browse,home].forEach(source=>{
      expect(source).toMatch(/ORMAMapStyle\.matchColour(Expression)?\(/);
      expect(source).not.toContain("65, '#C98A2E'");
    });
  });
});
