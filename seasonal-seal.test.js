const { seasonalLimitHolds, seasonalSealReport, SEASONAL_RULE_FROM } = require('./scripts/seasonal-seal');
const { researchMethodHolds } = require('./backoffice/workflows/research-methods');

const months = { recommended: { months: [6, 7, 8, 9] } };
const lift = { name: 'Test gondola', dependency: 'required', type: 'gondola' };
const dated = { ...months, lifts: [{ id: 'g', required: true, periods: [{ from: '06-01', to: '10-15' }] }] };
const sealed = (fields) => ({ id: 'x', graduation: { status: 'verified' }, verified: { date: '2026-11-12' }, season: months, ...fields });

describe('a hard seasonal limit is sourced', () => {
  test('a walk with months and no lift passes', () => {
    expect(seasonalLimitHolds({ season: months })).toEqual([]);
  });

  test('a walk with no months at all is held', () => {
    expect(seasonalLimitHolds({}).map((hold) => hold.id)).toEqual(['season-unrecorded']);
  });

  test('a walk that needs a lift needs its running dates', () => {
    expect(seasonalLimitHolds({ season: months, liftAccess: lift }).map((hold) => hold.id)).toEqual(['lift-dates-unpublished']);
    expect(seasonalLimitHolds({ season: dated, liftAccess: lift })).toEqual([]);
    expect(seasonalLimitHolds({ season: months, liftAccess: { ...lift, dependency: 'optional' } })).toEqual([]);
  });

  test('ski runs read off the map are sourced', () => {
    expect(seasonalLimitHolds({ season: { ...months, winterUse: [{ kind: 'downhill', km: 1, names: [] }] } })).toEqual([]);
  });
});

describe('who it holds', () => {
  test('a seal given under the rule fails; one given before is a gap, not a withdrawal', () => {
    const report = seasonalSealReport([
      sealed({ id: 'new', liftAccess: lift }),
      sealed({ id: 'old', liftAccess: lift, verified: { date: '2026-10-24' } }),
      sealed({ id: 'fine', liftAccess: lift, season: dated }),
      { id: 'reviewed', graduation: { status: 'reviewed' }, liftAccess: lift },
    ]);
    expect(report.ruleFrom).toBe(SEASONAL_RULE_FROM);
    expect(report.violations.map((entry) => entry.id)).toEqual(['new']);
    expect(report.gaps.map((entry) => entry.id)).toEqual(['old']);
  });

  test('no walk in the catalogue was sealed under the rule without it', () => {
    const { loadProductionTrails } = require('./scripts/load-production-trails');
    expect(seasonalSealReport(loadProductionTrails(__dirname)).violations).toEqual([]);
  });
});

describe('the backoffice seal', () => {
  test('holds a walk that needs a lift without dates, and not one without a season record yet', () => {
    const holds = (trail) => researchMethodHolds({ lockedFacts: [], evidenceSources: [] }, trail).holds;
    expect(holds({ liftAccess: lift })).toContain('lift-dates-unpublished');
    expect(holds({ liftAccess: lift, season: dated })).not.toContain('lift-dates-unpublished');
    expect(holds({})).not.toContain('season-unrecorded');
  });
});
