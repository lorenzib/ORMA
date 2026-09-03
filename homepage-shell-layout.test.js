const fs = require('fs');

describe('logged-in discovery workspace layout', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');

  test('uses a dedicated greeting row above the discovery controls', () => {
    expect(html).toContain('class="li-toolbar-greet"');
    expect(html).not.toContain('id="liToolbarSummary"');
    expect(css).toMatch(/grid-template-areas:\s*"greet greet greet greet greet greet greet greet greet"\s*"search country region valley filters quick saved plan record"/);
    expect(css).toMatch(/\.li-toolbar-greet\s*\{[^}]*display:flex;/s);
  });

  test('keeps the core filters and actions directly after the location controls', () => {
    expect(html).toContain('class="li-quick-filters"');
    expect(html).not.toContain('id="liQuickLeash"');
    expect(html).toContain('id="liQuickShade"');
    expect(html).toContain('id="liQuickWater"');
    expect(html.indexOf('id="liValleyWrap"')).toBeLessThan(html.indexOf('id="liFiltersWrap"'));
    expect(html.indexOf('id="liFiltersWrap"')).toBeLessThan(html.indexOf('id="liQuickShade"'));
    expect(html.indexOf('id="liSavedOnlyBtn"')).toBeLessThan(html.indexOf('class="li-plan-route"'));
    expect(html.indexOf('class="li-plan-route"')).toBeLessThan(html.indexOf('id="liRecordBtn"'));
    expect(html.indexOf('id="liQuickWater"')).toBeLessThan(html.indexOf('id="liSavedOnlyBtn"'));
    const editorialCss = fs.readFileSync('homepage-editorial.css', 'utf8');
    expect(editorialCss).toContain('#liFiltersWrap{display:none;}');
  });

  test('uses the same one-line desktop control rhythm as Browse All Trails', () => {
    const editorialCss = fs.readFileSync('homepage-editorial.css', 'utf8');
    expect(editorialCss).toContain('grid-template-columns:minmax(210px,2fr)');
    expect(editorialCss).toContain('@media (min-width:1101px)');
    expect(editorialCss).toContain('.li-mobile-actions,.li-quick-filters{display:contents;}');
    expect(editorialCss).toContain('#liQuickShade{grid-column:5;grid-row:2;}');
    expect(editorialCss).toContain('.li-plan-route{grid-area:auto;grid-column:8;grid-row:2;}');
    expect(editorialCss).toContain('.li-record{grid-area:auto;grid-column:9;grid-row:2;}');
  });

  test('contains the quick shade and water filters in white outlined controls', () => {
    const rule = css.match(/\.li-quick-filter\s*\{([^}]*)\}/s);
    expect(rule).not.toBeNull();
    expect(rule[1]).toContain('border:1.5px solid var(--paper-line)');
    expect(rule[1]).toContain('background:#fff');
    expect(rule[1]).toContain('height:42px');
    expect(rule[1]).not.toContain('background:transparent');
    expect(rule[1]).not.toContain('border:1px solid transparent');
    expect(css).toContain('#liQuickWater{gap:4px;padding-right:17px;}');
    expect(css).toContain('background:var(--success);color:#fff');
  });

  test('uses a secondary green for Draft a loop, distinct from the navigation green', () => {
    expect(css).toMatch(/\.li-plan-route\{[^}]*border:1\.5px solid var\(--success\);[^}]*background:var\(--success\);/s);
    expect(css).toContain('--success:#4A7856;');
    expect(css).toContain('--ink:#2E4034;');
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

  test('uses the full visual viewport and a two-row toolbar on short landscape screens', () => {
    const mobileCss = fs.readFileSync('homepage-mobile.css', 'utf8');
    expect(mobileCss).toContain('@media (orientation:landscape) and (max-height:520px) and (min-width:701px) and (max-width:1040px)');
    expect(mobileCss).toContain('width:100vw;max-width:none;height:100dvh;min-height:0;overflow:hidden;');
    expect(mobileCss).toContain('grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:36px 36px;');
    expect(mobileCss).toContain('.li-toolbar-greet{display:none;}');
    expect(html).toContain('homepage-mobile.css?v=20260903-1');
  });

  test('uses a dashed divider instead of a match box and keeps route facts legible', () => {
    expect(css).toMatch(/\.map-callout \.li-match\s*\{[^}]*background:transparent;[^}]*border-left:1px dashed var\(--paper-line\);/s);
    expect(css).toMatch(/\.li-row-meta\s*\{[^}]*color:var\(--ink\);[^}]*font-weight:500;/s);
    expect(html).not.toContain('id="returningCount"');
  });
});
