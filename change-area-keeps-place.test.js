/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://app-orma.com/?view=returning"}
 */
const fs=require('fs');
const source=fs.readFileSync('./script.js','utf8');
const page=fs.readFileSync('./index.html','utf8');
const styles=fs.readFileSync('./styles.css','utf8');

// Change used to call liResetLocationContext, which cleared the area, the
// country, region and valley, the map bounds and the selected trail, then hid
// the workspace. You could not see what you were moving away from, and picking
// somewhere new started from nothing.
describe('changing an area is not starting again', () => {
  test('Change opens the picker instead of resetting', () => {
    expect(source).toContain("changeLocation.addEventListener('click', liBeginLocationChange)");
    expect(source).not.toContain("changeLocation.addEventListener('click', liResetLocationContext)");
  });

  test('the workspace stays visible while changing', () => {
    // gate.hidden is false while changing, but toolbar and body follow `ready`.
    expect(source).toContain('if(gate) gate.hidden = ready && !changing;');
    expect(source).toContain('if(toolbar) toolbar.hidden = !ready;');
    expect(source).toContain('if(workspace) workspace.hidden = !ready;');
  });

  test('there is a way out that changes nothing', () => {
    expect(source).toContain('function liCancelLocationChange()');
    expect(page).toContain('id="liLocationCancelBtn"');
    expect(page).toContain('Keep where I am');
    expect(source).toContain("event.key === 'Escape' && liLocationChanging");
  });

  test('the question changes with the situation', () => {
    expect(page).toContain('Walk somewhere else?');
    expect(source).toContain('if(gateTitle) gateTitle.hidden = changing;');
  });

  // What a new area legitimately supersedes, and what it does not.
  test('a new area drops the old framing but keeps the dog’s filters', () => {
    const setter=source.slice(source.indexOf('function liSetLocationContext'),
      source.indexOf('function liResetLocationContext'));
    expect(setter).toContain('liMapBounds = null;');
    expect(setter).toContain('selectedTrailId = null;');
    expect(setter).toContain('liLocationChanging = false;');
    // Filters are only cleared by the explicit reset action.
    expect(setter).not.toContain('liFilters =');
  });

  test('only liResetAllFilters clears the filters', () => {
    // Two writes only: the declaration, and the explicit reset action.
    const writes=source.split('\n').filter(line=>/\bliFilters = \{/.test(line));
    expect(writes).toHaveLength(2);
    expect(writes[0]).toContain('let liFilters');
    const reset=source.slice(source.indexOf('function liResetAllFilters'));
    expect(reset.slice(0, 400)).toContain('liFilters = {');
  });

  test('the overlay leaves the results behind it', () => {
    expect(styles).toContain('body.li-location-changing .li-location-gate{');
    expect(styles).toContain('position:fixed;');
    expect(styles).toContain('body.li-location-changing::before{');
  });
});
