const feed = require('./notifications-feed.js');

describe('derived notifications feed', () => {
  const NOW = 1770000000000;
  const trails = [
    { id: 'shady', name: 'Shady Loop', heatRisk: 'low', surfaceHazards: [] },
    { id: 'ridge', name: 'Ridge Trail', heatRisk: 'high', shadeCoverage: 10,
      surfaceHazards: ['Rocky steps near the ridge'],
      verified: { date: '2026-07-17', sources: ['Seceda Cableways'] } },
    { id: 'meadow', name: 'Meadow Walk', heatRisk: 'high', shadeCoverage: 20,
      surfaceHazards: [], reviewedAt: '2026-07-10' },
  ];

  test('saved trails with heat or surface hazards produce today advisories', () => {
    const items = feed.build({ trails, favorites: { ridge: true }, now: NOW });
    const ids = items.map(i => i.id);
    expect(ids).toContain('heat-ridge');
    expect(ids).toContain('hazard-ridge');
    // Not saved → no advisory, even though meadow is high heat risk.
    expect(ids).not.toContain('heat-meadow');
    const heat = items.find(i => i.id === 'heat-ridge');
    expect(heat.group).toBe('today');
    expect(heat.alert).toBe(true);
    expect(heat.href).toBe('trail.html?id=ridge');
    expect(heat.body).toContain('10% shade');
  });

  test('audited trails appear for everyone with their audit date', () => {
    const items = feed.build({ trails, favorites: {}, now: NOW });
    const audit = items.find(i => i.id === 'audit-ridge');
    expect(audit).toBeDefined();
    expect(audit.group).toBe('earlier');
    expect(audit.timeLabel).toBe('17 Jul');
    expect(audit.body).toContain('Seceda Cableways');
    // reviewedAt-only trails still qualify.
    expect(items.some(i => i.id === 'audit-meadow')).toBe(true);
  });

  test('a recorded profile edit becomes a today item with relative time', () => {
    const items = feed.build({
      trails: [], favorites: {},
      profileEvent: { ts: NOW - 2 * 3600 * 1000, name: 'Eddie' }, now: NOW,
    });
    const p = items.find(i => i.id.startsWith('profile-'));
    expect(p.title).toBe('Eddie’s profile updated');
    expect(p.group).toBe('today');
    expect(p.timeLabel).toBe('2h ago');
  });

  test('unreadIds subtracts the seen list so read items stay read', () => {
    const items = feed.build({ trails, favorites: { ridge: true }, now: NOW });
    const all = feed.unreadIds(items, []);
    expect(all.length).toBe(items.length);
    expect(feed.unreadIds(items, all)).toEqual([]);
    expect(feed.unreadIds(items, ['heat-ridge'])).not.toContain('heat-ridge');
  });
});
