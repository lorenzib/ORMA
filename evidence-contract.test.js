const evidence = require('./trust/evidence-v1.js');
const fixtures = require('./trust/evidence-fixtures-v1.json');

describe('TRUST-01 evidence and freshness contract', () => {
  test('defines every canonical safety category', () => {
    expect(evidence.CATEGORIES).toEqual([
      'route', 'water', 'heat', 'exposure', 'livestock',
      'surfaceHazards', 'access',
    ]);
    expect(fixtures.evidenceVersion).toBe(evidence.VERSION);
  });

  test.each([
    ['imported', 'Imported map data'],
    ['route-audited', 'DoloPaws route-audited'],
    ['field-verified', 'DoloPaws field-verified'],
  ])('%s receives the canonical public label', (fixture, label) => {
    expect(evidence.assessTrail(fixtures.trails[fixture], {
      asOfDate: fixtures.asOfDate,
    }).tierLabel).toBe(label);
  });

  test('every category returns both source and freshness states', () => {
    const assessment = evidence.assessTrail(fixtures.trails['route-audited'], {
      asOfDate: fixtures.asOfDate,
    });
    for(const category of evidence.CATEGORIES){
      expect(assessment.categories[category]).toEqual(expect.objectContaining({
        sourceState: expect.any(String),
        sourceLabel: expect.any(String),
        freshnessState: expect.any(String),
        freshnessLabel: expect.any(String),
      }));
    }
  });

  test('missing safety dates remain visibly unknown', () => {
    const assessment = evidence.assessTrail(fixtures.trails.imported, {
      asOfDate: fixtures.asOfDate,
    });
    expect(assessment.categories.water.freshnessState).toBe('unknown');
    expect(assessment.categories.water.observedLabel).toBe('date unknown');
    expect(assessment.categories.water.sourceState).toBe('unknown');
  });

  test('category-specific review windows expose stale data', () => {
    const assessment = evidence.assessTrail(fixtures.trails['route-audited'], {
      asOfDate: fixtures.asOfDate,
    });
    expect(assessment.categories.route.freshnessState).toBe('current');
    expect(assessment.categories.water.freshnessState).toBe('stale');
    expect(assessment.categories.access.freshnessState).toBe('stale');
    expect(assessment.categories.exposure.freshnessState).toBe('current');
  });

  test('field-checked requires both field tier and field evidence', () => {
    const field = evidence.assessTrail(fixtures.trails['field-verified'], {
      asOfDate: fixtures.asOfDate,
    });
    const desk = evidence.assessTrail(fixtures.trails['route-audited'], {
      asOfDate: fixtures.asOfDate,
    });
    expect(field.categories.water.sourceState).toBe('field-checked');
    expect(desk.categories.water.sourceState).toBe('source-reviewed');
  });

  test('community observations remain separate from the DoloPaws assessment', () => {
    const withoutCommunity = evidence.assessTrail(fixtures.trails['route-audited'], {
      asOfDate: fixtures.asOfDate,
    });
    const withCommunity = evidence.assessTrail(fixtures.trails['route-audited'], {
      asOfDate: fixtures.asOfDate,
      communityReports: [{
        id: 'report-1',
        type: 'fallen-tree',
        status: 'unconfirmed',
        observedAt: '2026-07-27',
      }],
    });
    expect(withCommunity.categories).toEqual(withoutCommunity.categories);
    expect(withCommunity.tier).toBe(withoutCommunity.tier);
    expect(withCommunity.communityObservations).toEqual([
      expect.objectContaining({
        label: 'Community report · unconfirmed',
        status: 'unconfirmed',
      }),
    ]);
  });

  test('future or malformed dates cannot appear current', () => {
    expect(evidence.freshnessState('water', '2026-08-01', fixtures.asOfDate)).toBe('unknown');
    expect(evidence.freshnessState('water', 'not-a-date', fixtures.asOfDate)).toBe('unknown');
  });

  test('interactive and generated consumers reference the shared label contract', () => {
    const fs = require('fs');
    const interactive = fs.readFileSync(require.resolve('./trail-trust.js'), 'utf8');
    const generator = fs.readFileSync(require.resolve('./scripts/generate-trail-pages.js'), 'utf8');
    expect(interactive).toContain('DoloPawsEvidenceV1');
    expect(generator).toContain("require('../trust/evidence-v1.js')");
  });
});
