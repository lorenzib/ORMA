const fs=require('fs');
const {verdictFor,VERDICTS,STRONG_AT,POSSIBLE_AT}=require('./match-verdict.js');

// One trail, three answers. "Great match" on browse at 75, "Good" in the
// homepage search at 65, "Possible with cautions" in the homepage list at 60 --
// so a trail scoring 80 said something different depending on the screen.
describe('one vocabulary for one score', () => {
  test.each([
    [92,'Strong option'],
    [85,'Strong option'],
    [80,'Possible with cautions'],
    [60,'Possible with cautions'],
    [59,'Not recommended'],
    [5,'Not recommended'],
  ])('a score of %s reads as "%s" everywhere', (score,label) => {
    expect(verdictFor(score).label).toBe(label);
  });

  test('the cut-offs are the engine’s own', () => {
    const engine=fs.readFileSync('scoring/recommendation-v1.js','utf8');
    expect(engine).toContain(`score >= ${STRONG_AT} ? 'strong-option'`);
    expect(engine).toContain(`score >= ${POSSIBLE_AT} ? 'possible-with-cautions'`);
  });

  test('it says what to do, not how well the trail scored', () => {
    expect(Object.values(VERDICTS).map(entry=>entry.label))
      .toEqual(['Strong option','Possible with cautions','Not recommended']);
  });
});

// The part the score alone cannot carry.
describe('the engine’s verdict outranks the number', () => {
  test('a high score the engine downgraded stays downgraded', () => {
    // recommendation-v1.js: a critical unreviewed category drops a strong
    // option, and a bare score knows nothing about it.
    expect(verdictFor({score:90,category:'possible-with-cautions'}).label)
      .toBe('Possible with cautions');
    expect(verdictFor(90).label).toBe('Strong option');
  });

  test('a prohibited route is not recommended whatever its number', () => {
    expect(verdictFor({score:99,category:'not-recommended'}).label).toBe('Not recommended');
  });

  test('a recommendation with no category falls back to its score', () => {
    expect(verdictFor({score:90}).label).toBe('Strong option');
  });

  test('an unusable input is never called a strong option', () => {
    [null,undefined,{},'','abc',NaN].forEach(input=>
      expect(verdictFor(input).label).toBe('Not recommended'));
  });

  test('the score comes back with the verdict, or null if there was none', () => {
    expect(verdictFor(72).score).toBe(72);
    expect(verdictFor({}).score).toBeNull();
  });
});

describe('both surfaces ask the same question', () => {
  const browse=fs.readFileSync('browse-trails.html','utf8');
  const home=fs.readFileSync('script.js','utf8');
  const page=fs.readFileSync('index.html','utf8');

  test('browse reads the engine’s recommendation, not just the score', () => {
    expect(browse).toContain('window.DoloPawsScoring.recommendTrail(');
    expect(browse).toContain('const verdict = matchVerdict(t);');
    // The old thresholds are gone.
    expect(browse).not.toContain("match >= 75 ? 'Great match'");
  });

  test('the homepage search and list both defer to it', () => {
    expect(home).toContain('window.OrmaMatchVerdict');
    expect(home).not.toContain("score >= 65 ? { color: '#C98A2E', label: 'Good' }");
  });

  test('both pages load it', () => {
    expect(page).toContain('match-verdict.js');
    expect(browse).toContain('match-verdict.js');
  });

  test('no surface keeps a private vocabulary', () => {
    [browse,home].forEach(source=>{
      expect(source).not.toMatch(/'Great match'/);
      expect(source).not.toMatch(/'Check first'/);
    });
  });
});
