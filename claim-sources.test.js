const { baselineBlockers } = require('./backoffice/workflows/plan-catalogue-campaign');

// The blocker used to pass on any single link, so one OpenStreetMap URL would
// have cleared it for 156 trails while sourcing none of their claims.
const blockersFor = trail => baselineBlockers(
  { id: 't', name: 'T', path: [[46, 11], [46.1, 11.1]], externalRelationId: 'relation/1', ...trail }, [], [],
);

describe('claim-sources-missing', () => {
  test('clears when every reviewed category names a source', () => {
    expect(blockersFor({
      verified: { categories: ['access'] },
      sourceLinks: [{ label: 'Comune', url: 'https://c.it', categories: ['access'] }],
    })).not.toContain('claim-sources-missing');
  });

  test('does not clear on a link that covers nothing claimed', () => {
    // The exact shortcut this fix closes.
    expect(blockersFor({
      verified: { categories: ['access', 'livestock'] },
      sourceLinks: [{ label: 'OpenStreetMap', url: 'https://osm.org/relation/1', categories: [] }],
    })).toContain('claim-sources-missing');
  });

  test('does not clear when one claimed category is unsourced', () => {
    expect(blockersFor({
      verified: { categories: ['access', 'livestock'] },
      sourceLinks: [{ label: 'Comune', url: 'https://c.it', categories: ['access'] }],
    })).toContain('claim-sources-missing');
  });

  test('does not clear with sources but no recorded review', () => {
    expect(blockersFor({ sourceLinks: [{ label: 'Comune', url: 'https://c.it', categories: ['access'] }] }))
      .toContain('claim-sources-missing');
  });

  test('does not clear with no sources at all', () => {
    expect(blockersFor({ verified: { categories: ['access'] } })).toContain('claim-sources-missing');
  });
});
