const fs = require('fs');

describe('logged-in discovery workspace layout', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');

  test('uses a dedicated answer row above on-demand discovery controls', () => {
    expect(html).toContain('class="li-toolbar-greet"');
    expect(html).not.toContain('id="liToolbarSummary"');
    expect(html).toContain('id="liRecommendationDate"');
    expect(html).toContain('id="liAdjustRecommendationBtn"');
    expect(css).toMatch(/\.li-toolbar-greet\s*\{[^}]*display:flex;/s);
  });

  test('requires a geographic context before the recommendation workspace', () => {
    expect(html.indexOf('id="liLocationGate"')).toBeLessThan(html.indexOf('id="liToolbar"'));
    expect(html).toContain('id="liUseLocationBtn"');
    expect(html).toContain('id="liChooseAreaBtn"');
    expect(html).toContain('id="liChangeLocationBtn"');
    expect(html).toContain('Your precise position stays in this browser session');
    expect(html).toContain('src="images/orma-location-hero.jpg"');
    expect(html).toContain('id="liAreaSearch"');
    expect(html).toContain('id="liAreaCountry"');
    expect(html).toContain('id="liAreaRegion"');
    expect(html).toContain('id="liAreaSelect"');
    expect(html).toContain('id="liWalkDate"');
    expect(css).toContain('.li-location-gate[hidden],.li-toolbar[hidden],.li-body[hidden]{display:none!important;}');
  });

  test('replaces the geo dropdowns with unified search and moves create behind "+ New"', () => {
    expect(html).toContain('class="li-quick-filters"');
    expect(html).not.toContain('id="liQuickLeash"');
    expect(html).toContain('id="liQuickShade"');
    expect(html).toContain('id="liQuickWater"');
    // The three geography dropdowns and the toolbar Saved button are gone.
    expect(html).not.toContain('id="liCountryWrap"');
    expect(html).not.toContain('id="liRegionWrap"');
    expect(html).not.toContain('id="liValleyWrap"');
    expect(html).not.toContain('id="liSavedOnlyBtn"');
    // Both create actions live inside the "+ New" menu, plan before record.
    expect(html.indexOf('id="liSearchSuggest"')).toBeLessThan(html.indexOf('id="liNewBtn"'));
    expect(html.indexOf('class="li-menu-item li-plan-route"')).toBeLessThan(html.indexOf('id="liRecordBtn"'));
    // Saved becomes a view tab beside Sort in the list head.
    expect(html.indexOf('id="liViewSaved"')).toBeLessThan(html.indexOf('id="companionSortGroup"'));
    expect(html).toContain('class="li-list-options"');
  });

  test('keeps catalogue controls behind the recommendation adjustment action', () => {
    const editorialCss = fs.readFileSync('homepage-editorial.css', 'utf8');
    expect(editorialCss).toContain('.li-toolbar:not(.li-refine-open) .li-search');
    expect(editorialCss).toContain('.li-toolbar.li-refine-open .li-search{display:flex;');
    expect(editorialCss).toContain('.li-toolbar.li-refine-open #liFiltersWrap{display:block;');
    expect(editorialCss).toContain('@media (min-width:701px) and (max-width:1100px)');
    expect(html).toContain('Adjust recommendation');
  });

  test('keeps the recommendation hierarchy at desktop widths', () => {
    const editorialCss = fs.readFileSync('homepage-editorial.css', 'utf8');
    expect(editorialCss).toContain('@media (min-width:1041px)');
    expect(editorialCss).toContain('grid-template-columns:minmax(240px,1fr) auto auto auto;');
    expect(editorialCss).toContain('.li-toolbar.li-refine-open .li-new-wrap{grid-column:4;grid-row:3;}');
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

  test('gives the personalised answer more room beside the map', () => {
    expect(css).toContain('.li-body{grid-template-columns:minmax(0,1.05fr) minmax(480px,.95fr);}');
    expect(css).toContain('.li-row--answer{border-color:#9FC4B0;');
    expect(css).toContain('.li-answer-explanation{display:grid;');
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
    expect(html).toContain('homepage-mobile.css?v=20260909-1');
  });

  test('uses a dashed divider instead of a match box and keeps route facts legible', () => {
    expect(css).toMatch(/\.map-callout \.li-match\s*\{[^}]*background:transparent;[^}]*border-left:1px dashed var\(--paper-line\);/s);
    expect(css).toMatch(/\.li-row-meta\s*\{[^}]*color:var\(--ink\);[^}]*font-weight:500;/s);
    expect(html).not.toContain('id="returningCount"');
  });
});
