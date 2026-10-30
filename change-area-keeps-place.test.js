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
// The gate and its change-area overlay are gone: a place is typed in the
// search bar and becomes the context in place. What survives from that work
// is the contract of choosing somewhere new: the map framing and the selected
// trail go, the dog's filters and the date stay.
describe('choosing a new place keeps the dog’s filters', () => {
  test('a new area drops the old framing but keeps the dog’s filters', () => {
    const setter=source.slice(source.indexOf('function liSetLocationContext'),
      source.indexOf('function liResetLocationContext'));
    // The framing used to be a second box kept beside the context; it is the
    // context's own bounds now, so leaving the map area is what drops it.
    expect(setter).toContain("if(next.kind !== 'map') liExitMapArea();");
    expect(setter).toContain('selectedTrailId = null;');
    // Filters are only cleared by the explicit reset action.
    expect(setter).not.toContain('liFilters =');
  });

  test('only the reader\u2019s own clearing actions touch the filters', () => {
    // The declaration, Reset filters, and the list header's "Show all trails"
    // with its "Back to <area>", which hands the same filters back. Nothing
    // that merely changes the place may write them.
    const writes=source.split('\n').filter(line=>/\bliFilters = \{/.test(line));
    expect(writes).toHaveLength(4);
    expect(writes[0]).toContain('let liFilters');
    const body=name=>{
      const from=source.indexOf(`function ${name}(`);
      return source.slice(from, source.indexOf('\n}\n', from));
    };
    expect(body('liResetAllFilters')).toContain('liFilters = {');
    expect(body('liShowAllTrails')).toContain('liFilters = {');
    expect(body('liBackFromAllTrails')).toContain('liFilters = { ...saved.filters }');
  });

});
