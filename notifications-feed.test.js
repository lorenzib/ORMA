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

  test('live hazard flags on saved trails become alert items with trail names', () => {
    const items = feed.build({
      trails, favorites: {},
      hazardFlags: [
        { id: 'f1', trailId: 'ridge', type: 'water-dry', text: 'Fountain dry at km 2.',
          createdAt: NOW - 2 * 3600 * 1000, confirmationSource: 'community', confirmations: 3 },
        { id: 'f2', trailId: 'meadow', type: 'guard-dogs-livestock',
          createdAt: NOW - 3 * 864e5, confirmations: 0 },
      ],
      now: NOW,
    });
    const dry = items.find(i => i.id === 'flag-f1');
    expect(dry.title).toBe('Water source reported dry: Ridge Trail');
    expect(dry.alert).toBe(true);
    expect(dry.group).toBe('today');
    expect(dry.timeLabel).toBe('2h ago');
    expect(dry.body).toContain('Fountain dry at km 2.');
    expect(dry.body).toContain('Confirmed by 3 walkers');
    expect(dry.href).toBe('trail.html?id=ridge');
    const herd = items.find(i => i.id === 'flag-f2');
    expect(herd.group).toBe('earlier');
    expect(herd.body).toContain('Community report');
  });

  test('site notices appear for everyone, safety ones as alerts', () => {
    const items = feed.build({
      trails: [], favorites: {},
      siteNotices: [
        { id: 'n1', type: 'trail', title: 'Val Pusteria trails are live',
          body: 'Three new scored loops.', href: 'browse-trails.html', createdAt: NOW - 3600 * 1000 },
        { id: 'n2', type: 'safety', title: 'Heatwave weekend',
          body: 'Walk early.', createdAt: NOW - 2 * 864e5 },
      ],
      now: NOW,
    });
    const trail = items.find(i => i.id === 'notice-n1');
    expect(trail.alert).toBe(false);
    expect(trail.group).toBe('today');
    expect(trail.href).toBe('browse-trails.html');
    const safety = items.find(i => i.id === 'notice-n2');
    expect(safety.alert).toBe(true);
    expect(safety.icon).toBe('warning');
    expect(safety.group).toBe('earlier');
  });

  test('audit items age out of the feed after 30 days', () => {
    // NOW ≈ 2 Feb 2026: a mid-January audit is fresh, a mid-December one
    // is over 30 days old and must no longer appear as "news".
    const aged = [
      { id: 'fresh', name: 'Fresh Trail', verified: { date: '2026-01-10', sources: [] } },
      { id: 'stale', name: 'Stale Trail', verified: { date: '2025-12-15', sources: [] } },
    ];
    const ids = feed.build({ trails: aged, favorites: {}, now: NOW }).map(i => i.id);
    expect(ids).toContain('audit-fresh');
    expect(ids).not.toContain('audit-stale');
  });

  test('badgeCount uses the durable read set so resolved items stay off the bell', () => {
    const items = feed.build({ trails, favorites: { ridge: true }, now: NOW });
    expect(feed.badgeCount(items, [])).toBe(items.length);
    // Opening the centre records every current id as read: badge → 0 while
    // every item remains available in the feed history.
    expect(feed.badgeCount(items, items.map(i => i.id))).toBe(0);
    expect(feed.badgeCount(items, ['heat-ridge'])).toBe(items.length - 1);
  });

  test('unreadIds subtracts the seen list so read items stay read', () => {
    const items = feed.build({ trails, favorites: { ridge: true }, now: NOW });
    const all = feed.unreadIds(items, []);
    expect(all.length).toBe(items.length);
    expect(feed.unreadIds(items, all)).toEqual([]);
    expect(feed.unreadIds(items, ['heat-ridge'])).not.toContain('heat-ridge');
  });
});
