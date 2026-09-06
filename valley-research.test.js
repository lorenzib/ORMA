const {
  REVIEW_CATEGORIES, categoriesNeeded, groupByValley, worksheetFor,
  validateWorksheet, planApply,
} = require('./backoffice/workflows/valley-research');
const { renderEntry } = require('./backoffice/cli/valley-research');

const trail = (id, valley, verified) => ({ id, name: `Trail ${id}`, valley, ...(verified ? { verified } : {}) });
const source = (label, categories) => ({ label, url: `https://example-authority.it/${label}`, categories });

// A worksheet the validator accepts, used as the base for the apply tests.
function worksheet(sources, trails) {
  return { valley: 'Val Test', trails: trails.map(item => ({ id: item.id })), sources };
}

describe('valley research', () => {
  test('groups trails that still need work, biggest valley first', () => {
    const groups = groupByValley([
      trail('a', 'Big'), trail('b', 'Big'), trail('c', 'Small'),
      trail('d', 'Big', { categories: REVIEW_CATEGORIES }), // fully reviewed
    ]);
    expect(groups.map(group => [group.valley, group.trailCount])).toEqual([['Big', 2], ['Small', 1]]);
    // Only the fully reviewed trail drops out; there is nothing left to research.
    expect(groups[0].trails.map(item => item.id)).toEqual(['a', 'b']);
  });

  test('counts what each valley still needs, including partly reviewed trails', () => {
    // Having "access" recorded says nothing about heat or livestock, so a
    // partly reviewed trail must stay in the research pile.
    const [group] = groupByValley([trail('a', 'V'), trail('b', 'V', { categories: ['access'] })]);
    expect(group.trailCount).toBe(2);
    expect(group.categoriesNeeded.access).toBe(1); // only trail a still needs access
    expect(group.categoriesNeeded.water).toBe(2);  // both still need water
  });

  test('a blank worksheet cannot be applied', () => {
    const blank = worksheetFor(groupByValley([trail('a', 'V')])[0]);
    expect(validateWorksheet(blank)).toContain('No sources recorded yet. Add at least one before applying.');
  });

  test('refuses sources that are not real', () => {
    const errors = validateWorksheet({
      valley: 'V',
      sources: [{ label: '', url: 'https://example.com/x', categories: ['heat', 'vibes'] }],
    });
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('needs a label'),
      expect.stringContaining('looks like a placeholder'),
      expect.stringContaining('"vibes" is not a review category'),
    ]));
  });

  test('requires https, not a bare note', () => {
    const errors = validateWorksheet({ valley: 'V', sources: [{ label: 'Comune', url: 'asked by phone', categories: ['access'] }] });
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining('needs a full https:// URL')]));
  });

  // The rule the whole tool exists to enforce.
  test('records only the categories a source actually covers', () => {
    const trails = [trail('a', 'Val Test')];
    const { plans } = planApply(worksheet([source('Comune', ['access', 'livestock'])], trails), trails, '2026-09-06');
    expect(plans[0].categories).toEqual(['livestock', 'access']);
    expect(plans[0].verified.categories).toEqual(['livestock', 'access']);
    // Everything else stays unreviewed and is reported as such.
    expect(plans[0].stillMissing).toEqual(['water', 'heat', 'exposure', 'surfaceHazards']);
  });

  test('never back-dates: the review carries the date it was applied', () => {
    const trails = [trail('a', 'Val Test')];
    const sheet = worksheet([source('Comune', ['access'])], trails);
    sheet.reviewedOn = '1999-01-01'; // a date in the worksheet must be ignored
    const { plans } = planApply(sheet, trails, '2026-09-06');
    expect(plans[0].reviewedAt).toBe('2026-09-06');
    expect(plans[0].verified.date).toBe('2026-09-06');
  });

  test('attaches to each trail only the sources backing what it gained', () => {
    const trails = [trail('a', 'Val Test', { categories: ['access'] }), trail('b', 'Val Test')];
    const sources = [source('Access authority', ['access']), source('Livestock authority', ['livestock'])];
    const { plans } = planApply(worksheet(sources, trails), trails, '2026-09-06');
    // Trail a already has access, so it gains livestock only, sourced to the
    // livestock authority alone — the access source is not re-recorded.
    expect(plans[0].categories).toEqual(['livestock']);
    expect(plans[0].sourceLinks.map(link => link.label)).toEqual(['Livestock authority']);
    // Trail b gains both, and each recorded link declares only its own category.
    expect(plans[1].sourceLinks.map(link => link.categories)).toEqual([['livestock'], ['access']]);
  });

  test('skips a trail when no source covers what it still needs', () => {
    const trails = [trail('a', 'Val Test', { categories: ['access'] })];
    const { plans, skipped } = planApply(worksheet([source('Access authority', ['access'])], trails), trails, '2026-09-06');
    expect(plans).toHaveLength(0);
    expect(skipped[0].reason).toBe('no source covers what it still needs');
  });

  test('a fully reviewed trail is left alone', () => {
    const trails = [trail('a', 'Val Test', { categories: REVIEW_CATEGORIES })];
    const { plans, skipped } = planApply(worksheet([source('Authority', ['access'])], trails), trails, '2026-09-06');
    expect(plans).toHaveLength(0);
    expect(skipped[0].reason).toBe('every category already reviewed');
  });

  test('renders an entry that parses and keeps the file style', () => {
    const trails = [trail('a', 'Val Test')];
    const { plans } = planApply(worksheet([source('Comune di Test', ['access'])], trails), trails, '2026-09-06');
    const rendered = renderEntry(plans[0]);
    expect(() => new Function(`const audits={${rendered}};return audits;`)()).not.toThrow();
    expect(rendered).toContain("reviewedAt: '2026-09-06'");
    expect(rendered).toContain("reviewedBy: 'ORMA valley research'");
    expect(rendered).toContain('every other category stays unreviewed');
  });

  test('categoriesNeeded never invents a category', () => {
    expect(categoriesNeeded({ verified: { categories: ['access'] } }).every(c => REVIEW_CATEGORIES.includes(c))).toBe(true);
  });
});
