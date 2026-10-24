const fs = require('fs');

describe('logged-in discovery workspace layout', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');

  test('uses a dedicated answer row above on-demand discovery controls', () => {
    expect(html).toContain('class="li-toolbar-greet"');
    expect(html).not.toContain('id="liToolbarSummary"');
    expect(html).toContain('id="liRecommendationDate"');
    // The place and the day are words in the headline, each opening its own
    // menu; nothing waits behind "Adjust recommendation" any more.
    expect(html).not.toContain('liAdjustRecommendationBtn');
    expect(html).toContain('id="liAreaMenu"');
    expect(html).toContain('id="liDayMenu"');
    expect(css).toMatch(/\.li-toolbar-greet\s*\{[^}]*display:flex;/s);
  });

  test('the recommendation workspace is there from the first paint, with location offered in place', () => {
    // No gate: the toolbar, list and map open on the whole catalogue. Location
    // is a band above the list that asks only on tap, and the search bar is
    // where a place is typed.
    expect(html).not.toContain('id="liLocationGate"');
    expect(html).not.toContain('id="liUseLocationBtn"');
    expect(html).not.toContain('id="liAreaPicker"');
    expect(html.indexOf('id="liLocationNudge"')).toBeGreaterThan(html.indexOf('id="liToolbar"'));
    expect(html.indexOf('id="liLocationNudge"')).toBeLessThan(html.indexOf('id="liSearch"'));
    expect(html).toContain('id="liLocationNudgeBtn"');
    expect(html).toContain('Your position stays in this browser session and is not added to your profile.');
    expect(html).toContain('id="liChangeLocationBtn"');
    // One region at a time: the place menu offers the two regions, never "All".
    expect(html).not.toContain('id="liShowAllBtn"');
    expect(html).toContain('data-li-region="dolomites"');
    expect(html).toContain('data-li-region="savoy"');
    // Scope lives in one place: the three controls sit together on the location
    // summary rather than half there and half behind an Explore menu.
    expect(html).not.toContain('id="liExploreBtn"');
    expect(html).not.toContain('id="liExploreMenu"');
    expect(html).toContain('id="liNearMeBtn"');
    expect(html.indexOf('data-li-region="savoy"')).toBeLessThan(html.indexOf('id="liNearMeBtn"'));
    expect(html.indexOf('id="liNearMeBtn"')).toBeLessThan(html.indexOf('id="liChangeLocationBtn"'));
    expect(css).toContain('.li-toolbar[hidden],.li-body[hidden]{display:none!important;}');
    expect(css).not.toContain('.li-location-gate');
  });

  test('replaces the geo dropdowns with unified search and names the create actions', () => {
    expect(html).toContain('class="li-quick-filters"');
    expect(html).not.toContain('id="liQuickLeash"');
    expect(html).toContain('id="liQuickShade"');
    expect(html).toContain('id="liQuickWater"');
    // The three geography dropdowns and the toolbar Saved button are gone.
    expect(html).not.toContain('id="liCountryWrap"');
    expect(html).not.toContain('id="liRegionWrap"');
    expect(html).not.toContain('id="liValleyWrap"');
    expect(html).not.toContain('id="liSavedOnlyBtn"');
    // Create actions used to sit behind a button labelled "+ New", which named
    // neither of them: nothing on the page said a walk could be recorded at
    // all. Recording is the one you do standing on the trail, so it is now the
    // button itself -- a real link to walk.html, which is also what
    // device-handoff listens for -- and drafting a loop is the thing left in
    // the menu rather than a second copy of the same action.
    // It sits beside the headline now, ahead of the search row.
    expect(html.indexOf('id="liNewBtn"')).toBeLessThan(html.indexOf('id="liSearchSuggest"'));
    expect(html).toContain('id="liRecordBtn" href="walk.html"');
    expect(html).toContain('>Record<span class="li-new-label-rest"> a walk</span><');
    expect(html.indexOf('id="liRecordBtn"')).toBeLessThan(html.indexOf('id="liNewBtn"'));
    // The menu holds the other thing you can make, not a second copy of the
    // button. (The footer's own "Record a walk" link is a different control
    // and stays.)
    const createMenu = html.slice(html.indexOf('id="liNewMenu"'), html.indexOf('id="liNewMenu"') + 500);
    expect(createMenu).toContain('li-plan-route');
    expect(createMenu).not.toContain('Record a walk');
    // The list header is one line: title, count, a Sort dropdown and a Saved
    // toggle. The kicker, the news line and the fold-out of tabs are gone.
    const head = html.slice(html.indexOf('class="li-list-head"'), html.indexOf('id="returningTrailList"'));
    expect(head).toContain('<h2 class="li-list-title" id="companionListTitle">');
    expect(head).toContain('id="companionListCount"');
    expect(head).toContain('<select id="companionSortSelect" aria-label="Sort trails">');
    expect(head).toContain('id="liViewSaved" class="li-saved-toggle" aria-pressed="false"');
    expect(head.indexOf('id="companionSortSelect"')).toBeLessThan(head.indexOf('id="liViewSaved"'));
    for(const gone of ['companionKicker', 'returningSubline', 'li-list-options', 'liViewAll', 'companionSortGroup', 'li-explore-all']){
      expect(html).not.toContain(gone);
    }
    // Browse all trails moved to the foot of the list.
    expect(html).toContain('<a class="li-list-foot" href="browse-trails.html">Browse all trails →</a>');
  });

  test('keeps place, day, search, Filters and Record a walk on screen', () => {
    const editorialCss = fs.readFileSync('homepage-editorial.css', 'utf8');
    // Nothing is folded away behind a toggle.
    expect(editorialCss).not.toContain('li-refine-open');
    expect(fs.readFileSync('script.js', 'utf8')).not.toContain('li-refine-open');
    expect(editorialCss).toContain('#returningCustomerHomepage #liToolbar .li-search{');
    // Record a walk sits beside the headline, inside the greeting row.
    const greet = html.slice(html.indexOf('class="li-toolbar-greet"'), html.indexOf('id="liToday"'));
    expect(greet).toContain('id="liRecordBtn"');
    expect(greet).toContain('id="liAreaMenu"');
    expect(greet).toContain('id="liDayMenu"');
    // Shade and water are inside Filters, with the rest of the narrowing.
    const filters = html.slice(html.indexOf('id="liFiltersMenu"'), html.indexOf('id="liFiltersApply"'));
    expect(filters).toContain('id="liQuickShade"');
    expect(filters).toContain('id="liQuickWater"');
    expect(html).toContain('<span class="li-filt-label">Filters</span>');
  });

  test('announces Draw your own route once, under Record a walk', () => {
    const editorialCss = fs.readFileSync('homepage-editorial.css', 'utf8');
    const source = fs.readFileSync('script.js', 'utf8');
    // Hidden until the script decides it has not been seen.
    const wrap = html.slice(html.indexOf('id="liNewWrap"'), html.indexOf('id="liAreaMenu"'));
    expect(wrap).toContain('<div class="li-new-callout" id="liNewCallout" role="status" hidden>');
    expect(wrap).toContain('id="liNewCalloutTry" href="route-planner.html"');
    expect(wrap).toContain('id="liNewCalloutClose" aria-label="Dismiss"');
    // Seen for good once closed, tried, or once either way in is used.
    expect(source).toContain("const LI_NEW_CALLOUT_KEY = 'orma-new-draw-route-callout-v1';");
    expect(source).toContain("['liNewBtn', 'homeMapDrawBtn'].forEach(id => {");
    // Wider screens give it room instead of laying it over Filters.
    expect(editorialCss).toContain('#returningCustomerHomepage #liToolbar .li-new-callout{position:relative;');
    // The menu entry is a plain row with the tag on its title line.
    expect(html).toContain('<span class="li-menu-title">Draw your own route <span class="li-menu-badge">New</span></span>');
    expect(editorialCss).toContain('.li-new-menu .li-menu-item.li-plan-route{display:flex;height:auto;margin:0;border:0;');
  });

  test('lays the toolbar out the same way at every width', () => {
    const editorialCss = fs.readFileSync('homepage-editorial.css', 'utf8');
    expect(editorialCss).toContain('grid-template-areas:"greet greet" "today today" "nudge nudge" "search filters";');
    // Phones: headline on its own row, then search, Filters and Record.
    expect(editorialCss).toContain('grid-template-areas:"greet greet greet" "today today today" "search filters new" "nudge nudge nudge";');
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
    expect(css).toContain('.li-row--answer{border:2px solid #8FB89F;');
    expect(css).toContain('.li-answer-explanation{display:grid;');
    expect(css).toContain('.li-answer-open{display:inline-flex;');
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
    expect(html).toContain('homepage-mobile.css?v=20260916-1');
  });

  test('uses a dashed divider instead of a match box and keeps route facts legible', () => {
    expect(css).toMatch(/\.map-callout \.li-match\s*\{[^}]*background:transparent;[^}]*border-left:1px dashed var\(--paper-line\);/s);
    expect(css).toMatch(/\.li-row-meta\s*\{[^}]*color:var\(--ink\);[^}]*font-weight:500;/s);
    expect(html).not.toContain('id="returningCount"');
  });
});
