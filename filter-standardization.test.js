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

    expect((homepage.match(/discovery-filter-trigger/g) || [])).toHaveLength(2);
    expect((homepage.match(/discovery-filter-panel/g) || [])).toHaveLength(2);
    expect(browse).toContain('id="browseFiltersBtn" class="li-filt discovery-filter-trigger"');
    expect(browse).toContain('id="browseFiltersMenu" hidden');
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
});
