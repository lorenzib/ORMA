const status = require('./scripts/backoffice-status');

describe('backoffice status report', () => {
  test('catalogue counts cover every trail across the three tiers', () => {
    const c = status.catalogueCounts();
    expect(c.total).toBeGreaterThan(100);
    const summed = c.tiers['under-review'] + c.tiers['route-audited'] + c.tiers['dolopaws-walked'];
    expect(summed).toBe(c.total);
  });

  test('builds a full report without credentials, falling back to snapshots', async () => {
    const report = await status.buildStatus();
    expect(report.source.mode).toBe('snapshot');
    expect(report.catalogue.total).toBeGreaterThan(100);
    expect(Array.isArray(report.routeGates)).toBe(true);
    // The known route decisions live in the committed snapshot.
    const titles = report.routeGates.map((i) => i.title || '').join(' | ');
    expect(titles).toMatch(/Tre Cime/i);
  });
});
