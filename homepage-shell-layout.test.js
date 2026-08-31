const fs = require('fs');

describe('logged-in discovery workspace layout', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');

  test('uses a dedicated greeting row above the discovery controls', () => {
    expect(html).toContain('class="li-toolbar-greet"');
    expect(html).toContain('id="liToolbarSummary"');
    expect(css).toMatch(/grid-template-areas:\s*"greet greet greet greet greet greet greet"\s*"search country region valley filters quick saved"/);
    expect(css).toMatch(/\.li-toolbar-greet\s*\{[^}]*display:flex;/s);
  });

  test('places advanced filtering directly after the location controls', () => {
    expect(html).toContain('class="li-quick-filters"');
    expect(html).not.toContain('id="liQuickLeash"');
    expect(html).toContain('id="liQuickShade"');
    expect(html).toContain('id="liQuickWater"');
    expect(html.indexOf('id="liValleyWrap"')).toBeLessThan(html.indexOf('id="liFiltersWrap"'));
    expect(html.indexOf('id="liFiltersWrap"')).toBeLessThan(html.indexOf('id="liQuickShade"'));
    expect(html.indexOf('id="liQuickWater"')).toBeLessThan(html.indexOf('id="liSavedOnlyBtn"'));
  });

  test('contains the quick shade and water filters in white outlined controls', () => {
    const rule = css.match(/\.li-quick-filter\s*\{([^}]*)\}/s);
    expect(rule).not.toBeNull();
    expect(rule[1]).toContain('border:1.5px solid var(--paper-line)');
    expect(rule[1]).toContain('background:#fff');
    expect(rule[1]).toContain('height:42px');
    expect(rule[1]).not.toContain('background:transparent');
    expect(rule[1]).not.toContain('border:1px solid transparent');
  });

  test('balances a bounded map with a proportional results pane', () => {
    expect(css).toMatch(/\.li-body\s*\{[^}]*grid-template-columns:minmax\(0,1\.65fr\) minmax\(380px,\.9fr\);[^}]*height:500px;/s);
    const desktopShellRule = css.match(/#returningCustomerHomepage\s*\{([^}]*)\}/);
    expect(desktopShellRule).not.toBeNull();
    expect(desktopShellRule[1]).not.toContain('height:100dvh');
  });

  test('gives the map the same breathing room above and below', () => {
    expect(css).toMatch(/#returningCustomerHomepage\s*\{[^}]*--li-map-section-gap:18px;/s);
    expect(css).toMatch(/#returningCustomerHomepage > \.li-toolbar\s*\{[^}]*padding-bottom:var\(--li-map-section-gap\);/s);
    expect(css).toMatch(/#returningCustomerHomepage > \.li-body\s*\{[^}]*margin-bottom:var\(--li-map-section-gap\);/s);
  });

  test('keeps one trails toggle anchored while the results pane collapses', () => {
    expect(html.match(/id="liCollapseTrailsBtn"/g)).toHaveLength(1);
    expect(html).not.toContain('id="liShowTrailsBtn"');
    expect(css).toMatch(/\.li-trails-toggle\s*\{[^}]*position:absolute;top:12px;right:20px;/s);
  });

  test('uses a dashed divider instead of a match box and keeps route facts legible', () => {
    expect(css).toMatch(/\.map-callout \.li-match\s*\{[^}]*background:transparent;[^}]*border-left:1px dashed var\(--paper-line\);/s);
    expect(css).toMatch(/\.li-row-meta\s*\{[^}]*color:var\(--ink\);[^}]*font-weight:500;/s);
    expect(html).not.toContain('id="returningCount"');
  });
});
