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
      'Eddie’s walk — 4.2 km in 1h 05 · Alpe di Siusi Meadow Loop. Tracked with ORMA 🐾 app-orma.com');
    const anonymous = card.shareText({ dist: '1.0', dur: '30', trail: 'Recorded walk' }, '');
    expect(anonymous).toBe('Our walk — 1.0 km in 30 min. Tracked with ORMA 🐾 app-orma.com');
  });

  test('fmtDuration switches from minutes to hours at 60', () => {
    expect(card.fmtDuration(45)).toBe('45 min');
    expect(card.fmtDuration(60)).toBe('1h 00');
    expect(card.fmtDuration(125)).toBe('2h 05');
  });
});
