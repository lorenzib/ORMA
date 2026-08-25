const icons = require('./icon-system.js');

describe('ORMA icon system', () => {
  test('provides icon-based chip labels without emoji fallbacks', () => {
    const html = icons.chipHtml('adjust', "Adjust for today's conditions");
    expect(html).toContain('svg');
    expect(html).toContain("Adjust for today&#39;s conditions");
    expect(html).not.toContain('⚡');
  });

  test('returns shared map icon expressions with unknown fallback', () => {
    const expr = icons.getPoiMapIconExpression('huts');
    expect(expr).toContain(icons.getMapImageName('hut-alpine'));
    expect(expr[expr.length - 1]).toBe(icons.getMapImageName('unknown'));
  });

  test('uses matching circle colors for water categories', () => {
    const expr = icons.getPoiCircleColorExpression('water');
    expect(expr).toContain('#4E90A8');
    expect(expr).toContain('#228B22');
    expect(expr[expr.length - 1]).toBe('#5A5548');
  });

  test('keeps shade and water quick filters in the shared colourful icon language', () => {
    expect(icons.renderIconSvg('water')).toContain('fill="#378ADD"');
    expect(icons.renderIconSvg('shade')).toContain('fill="#2C5C34"');
    expect(icons.renderIconSvg('shade')).toContain('fill="#8A5A16"');
  });

  test('renders collection themes as filled multicolour glyphs', () => {
    ['gentle','summer','scenic'].forEach((key) => {
      const svg = icons.renderIconSvg(key);
      expect(svg).toContain('<svg');
      expect(svg).toContain('fill="');
      expect(svg).not.toContain('unknown');
    });
    expect(icons.renderIconSvg('gentle')).toContain('fill="#D98AA3"');
    expect(icons.renderIconSvg('gentle')).toContain('fill="#D6A038"');
  });

  test('renders product statuses through one badge component', () => {
    const verified = icons.badgeHtml('verified', 'Verified by ORMA');
    const caution = icons.badgeHtml('caution', 'Caution');
    expect(verified).toContain('dp-badge dp-badge--verified');
    expect(verified).toContain('<svg');
    expect(caution).toContain('dp-badge dp-badge--caution');
    expect(verified + caution).not.toMatch(/[🐾🗺️⚠️]/u);
  });

  test('provides shared functional icons used outside the map', () => {
    ['verified','imported','new','heat','warning','mountain','camera','pace-low','pace-medium','pace-high'].forEach((key) => {
      expect(icons.renderIconSvg(key)).toContain('<svg');
      expect(icons.renderIconSvg(key)).not.toContain('unknown');
    });
  });
});
