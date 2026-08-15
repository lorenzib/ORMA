const fs = require('fs');
const path = require('path');

function source(file){
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

describe('Trail comparison journey', () => {
  const browse = source('browse-trails.html');
  const page = source('compare.html');
  const controller = source('compare-page.js');
  const trail = source('trail.js');
  const trailBlueprint = source('trail-blueprint.js');
  const mobileNav = source('mobile-nav.js');

  test('Browse exposes persistent two-to-three trail selection', () => {
    expect(browse).toContain('data-compare-id="${esc(t.id)}"');
    expect(browse).toContain('compareApi.MAX_TRAILS');
    expect(browse).toContain("ready = selected.length >= 2");
    expect(browse).toContain('comparison-state.js');
  });

  test('comparison includes every decision row and an explicit unknown state', () => {
    [
      'Dog match', 'Reasons & cautions', 'Distance', 'Elevation',
      'Expected time', 'Terrain', 'Exposure', 'Shade', 'Heat', 'Water',
      'Surface hazards', 'Dog restrictions', 'Verification',
    ].forEach(label => expect(controller).toContain(label));
    expect(page).toContain('.compare-cell--unknown');
    expect(page).toContain('Unknown means ORMA does not have enough reviewed evidence');
  });

  test('mobile comparison scrolls with sticky labels', () => {
    expect(page).toContain('@media(max-width:700px)');
    expect(page).toContain('.compare-scroll{overflow-x:auto');
    expect(page).toContain('.compare-label{position:sticky;left:0');
    expect(controller).toContain('tabindex="0"');
  });

  test('users can remove a trail, open details, and return to comparison', () => {
    expect(controller).toContain('data-remove-id=');
    expect(controller).toContain('stateApi.toggle(selectedIds, button.dataset.removeId)');
    expect(controller).toContain('trail.html?id=${encodeURIComponent(entry.id)}&from=${encodeURIComponent(compareReturn)}');
    expect(trail).toMatch(/browse-trails\|compare\|saved\|journal/);
    expect(trail).toContain("returnTarget.startsWith('compare.html') ? '← Back to comparison'");
    expect(trailBlueprint).toContain("/^browse-trails\\.html(?:[?#]|$)/");
    expect(mobileNav).toContain("f === 'compare.html'");
  });
});
