const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('shared trail-filter experience', () => {
  const vocabulary = [
    'Under 5 km', '5–10 km', '10 km+',
    'Low risk', 'Moderate', 'Caution',
    'Gentle only', 'Up to mixed', 'Rocky is okay',
    '60%+', '75%+', '85%+',
  ];

  test('uses one trigger and panel treatment in all three discovery contexts', () => {
    const homepage = read('index.html');
    const browse = read('browse-trails.html');
    const styles = read('styles.css');

    expect((homepage.match(/discovery-filter-trigger/g) || [])).toHaveLength(2);
    expect((homepage.match(/discovery-filter-panel/g) || [])).toHaveLength(2);
    expect(browse).toContain('id="browseFiltersBtn" class="li-filt discovery-filter-trigger"');
    expect(browse).toContain('id="browseFiltersMenu" hidden');
    expect(styles).toMatch(/\.li-filters-menu\{position:fixed;top:auto;bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\);/);
    expect(styles).toMatch(/\.hp-fpanel\.discovery-filter-panel\{position:fixed;top:auto;bottom:max\(8px,env\(safe-area-inset-bottom,0px\)\);/);
  });

  test('uses one geographic filter treatment on homepage, browse and collections', () => {
    const homepage = read('index.html');
    const browse = read('browse-trails.html');
    const collections = read('collections.html');
    const geoStyles = read('geo-filters.css');

    [homepage, browse, collections].forEach(html => {
      expect(html).toContain('geo-filters.css?v=20260904-1');
      expect((html.match(/geo-filter-control/g) || [])).toHaveLength(3);
    });
    expect(geoStyles).toContain('width:205px');
    expect(geoStyles).toContain('height:46px');
    expect(geoStyles).toContain('border-radius:999px');
    expect(geoStyles).toContain('color:#3E7A91');
    expect(geoStyles).toContain('border-right:2.5px solid #66776C');
    expect(geoStyles).toContain('width:min(240px,calc(100vw - 32px))');
    expect(geoStyles).toContain('.geo-filter-control:last-child .area-select-menu');
  });

  test('keeps all three collection filters in one mobile row and aligns homepage menus', () => {
    const styles = read('styles.css');
    const mobile = read('homepage-mobile.css');

    expect(styles).toContain('.collection-area-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;gap:7px;}');
    expect(styles).toContain('.collection-area-filters .collection-area-filter:last-child{grid-column:auto;}');
    expect(mobile).toContain('body.mhome-active .li-menuwrap{position:relative;}');
    expect(mobile).toContain('body.mhome-active .li-region-wrap .li-menu{left:50%;transform:translateX(-50%);}');
    expect(mobile).toContain('body.mhome-active .li-valley-wrap .li-menu{left:auto;right:0;transform:none;}');
    expect(mobile).toContain("font:650 13px 'Inter',sans-serif;");
    expect(mobile).toContain('font-weight:800;');
  });

  test('keeps homepage geography at the Collections width without overlapping actions', () => {
    const styles = read('styles.css');
    const geoStyles = read('geo-filters.css');

    expect(styles).toMatch(/\.li-toolbar\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:minmax\(260px,1fr\) auto auto auto auto auto auto auto auto;/);
    expect(styles).toContain('"search country region valley filters quick saved plan record";');
    expect(styles).toContain('.li-mobile-actions{display:contents;}');
    expect(geoStyles).toMatch(/\.li-toolbar \.geo-filter-control\{[\s\S]*?width:205px;[\s\S]*?flex:0 0 205px;/);
    expect(geoStyles).toMatch(/@media\(max-width:760px\)\{[\s\S]*?\.li-toolbar \.geo-filter-control\{[\s\S]*?width:100%;[\s\S]*?min-width:0;/);
  });

  test.each(vocabulary)('keeps “%s” consistent across guest, browse and logged-in filters', label => {
    expect(read('homepage-search.js')).toContain(label);
    expect(read('browse-trails.html')).toContain(label);
    expect(read('script.js')).toContain(label);
  });

  test('keeps shade and water visible outside the expanded filters', () => {
    const homepage = read('index.html');
    const browse = read('browse-trails.html');

    ['Distance', 'Trail rating', 'Terrain underfoot', 'Minimum match']
      .forEach(label => {
        expect(homepage).toContain(label);
        expect(browse).toContain(label);
      });
    expect(homepage).toContain('id="liRiskSeg"');
    expect(homepage).not.toContain('id="liShadeSeg"');
    expect(homepage).not.toContain('id="hpShadeSeg"');
    expect(browse).not.toContain('id="brShadeSeg"');
    expect(homepage).toContain('id="hpWaterToggle" role="switch"');
    expect(browse).not.toContain('id="brWaterToggle"');
    expect(browse).toContain('id="browseQuickShade"');
    expect(browse).toContain('id="browseWater"');
    expect(browse).toContain('id="browseSavedOnly"');
    expect(homepage).toContain('id="liQuickWater"');
    expect(homepage).not.toContain('id="liToggleRows"');
  });

  test('shows a live result count on every apply action', () => {
    expect(read('homepage-search.js')).toContain("el.filtersApply.textContent = 'Show ' + n");
    expect(read('browse-trails.html')).toContain('filtersApply.textContent = `Show ${pool.length}');
    expect(read('script.js')).toContain('applyBtn.textContent = `Show ${displayList.length}');
  });

  test('keeps both trail toolbars usable at the narrow-tablet breakpoint', () => {
    const styles = read('styles.css');
    const browse = read('browse-trails.html');

    expect(styles).toContain('grid-template-columns:repeat(6,minmax(0,1fr))');
    expect(styles).toContain('.li-search{grid-column:1/-1;width:100%;max-width:none;}');
    expect(browse).toContain('.browse-area-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(browse).toContain('.browse-primary-controls .browse-search-shell{grid-column:1/-1;');
    expect(browse).toContain('.browse-quick-filters{grid-column:1/span 4;grid-row:4;');
    expect(browse).toContain('.browse-saved-only{grid-column:5/span 2;grid-row:4;');
    expect(browse).toContain('.browse-area-controls{grid-template-columns:repeat(3,minmax(0,1fr));}');
    expect(browse).toContain('overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;');
  });
});
