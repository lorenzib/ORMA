const card = require('./walk-card.js');

describe('shareable walk card helpers', () => {
  test('projectRoute fits the box, honours padding, and puts north up', () => {
    const route = [
      [46.500, 11.600],  // south end
      [46.510, 11.605],
      [46.520, 11.610],  // north end
    ];
    const pts = card.projectRoute(route, 800, 600, 50);
    expect(pts).toHaveLength(3);
    pts.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(50 - 1e-6);
      expect(x).toBeLessThanOrEqual(750 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(50 - 1e-6);
      expect(y).toBeLessThanOrEqual(550 + 1e-6);
    });
    // Higher latitude renders higher on the canvas (smaller y).
    expect(pts[2][1]).toBeLessThan(pts[0][1]);
    // Fewer than two valid points yields nothing to draw.
    expect(card.projectRoute([[46.5, 11.6]], 800, 600, 50)).toEqual([]);
    expect(card.projectRoute(null, 800, 600, 50)).toEqual([]);
  });

  test('shareText reads naturally with and without a named walk', () => {
    const named = card.shareText(
      { dist: '4.2', dur: '65', trail: 'Alpe di Siusi Meadow Loop' }, 'Eddie');
    expect(named).toBe(
      'Eddie’s Trail Tale — 4.2 km in 1h 05 · Alpe di Siusi Meadow Loop. Made with ORMA 🐾 app-orma.com');
    const anonymous = card.shareText({ dist: '1.0', dur: '30', trail: 'Recorded walk' }, '');
    expect(anonymous).toBe('Our Trail Tale — 1.0 km in 30 min. Made with ORMA 🐾 app-orma.com');
  });

  test('confirmed dog recap appears in the caption without inventing details', () => {
    const entry = { dist: 3, dur: 50, trail: 'Forest loop', tale: { energy: 'zoomies' } };
    expect(card.taleSentence(entry, 'Eddie')).toBe('Eddie’s verdict: still had zoomies.');
    expect(card.shareText(entry, 'Eddie')).toContain('Eddie’s verdict: still had zoomies.');
    expect(card.taleSentence({ tale: {} }, 'Eddie')).toBe('');
  });

  test('route privacy masks 200 m at both ends without changing the journal route', () => {
    const route = [
      [46.0000, 11.0000], [46.0020, 11.0000], [46.0040, 11.0000],
      [46.0060, 11.0000], [46.0080, 11.0000], [46.0100, 11.0000],
    ];
    const original = JSON.parse(JSON.stringify(route));
    const masked = card.maskRouteEnds(route, 200);
    expect(masked.length).toBeGreaterThanOrEqual(2);
    expect(masked[0][0]).toBeGreaterThan(route[0][0]);
    expect(masked[masked.length - 1][0]).toBeLessThan(route[route.length - 1][0]);
    expect(route).toEqual(original);
    expect(card.routeForShare({ route }, {})).toEqual(masked);
    expect(card.routeForShare({ route }, { hideRoute: true })).toEqual([]);
    expect(card.routeForShare({ route }, { hideEnds: false })).toEqual(route);
  });

  test('a route too short to mask safely is hidden', () => {
    expect(card.maskRouteEnds([[46, 11], [46.001, 11]], 200)).toEqual([]);
  });

  test('social formats use the expected aspect ratios', () => {
    expect(card.formatSize('post')).toEqual({ width: 1080, height: 1350 });
    expect(card.formatSize('story')).toEqual({ width: 1080, height: 1920 });
    expect(card.formatSize('square')).toEqual({ width: 1080, height: 1080 });
  });

  test('fmtDuration switches from minutes to hours at 60', () => {
    expect(card.fmtDuration(45)).toBe('45 min');
    expect(card.fmtDuration(60)).toBe('1h 00');
    expect(card.fmtDuration(125)).toBe('2h 05');
  });
});
