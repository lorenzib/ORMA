const { splitSources, SOURCES } = require('./route-guidance-sources.js');
const { READ_FROM_MAP } = require('./backoffice/workflows/route-guidance-from-map');
const { ORMA_SUGGESTION } = require('./backoffice/workflows/route-guidance-from-record');

describe('route directions say where they came from once per card', () => {
  const OLD_MAP = 'Read from the OpenStreetMap route relations this walk is built from, not from a published route description.';

  test('knows the sentences the writers put on each value, and the one the map used before', () => {
    const known = SOURCES.flatMap(source => source.sentences);
    expect(known).toContain(READ_FROM_MAP);
    expect(known).toContain(ORMA_SUGGESTION);
    expect(known).toContain(OLD_MAP);
  });

  test('takes the sentence off every line and names what each source covers', () => {
    const { lines, note } = splitSources([
      ['Start', `Start at the car park, marked on the map. ${ORMA_SUGGESTION} Check current access before travelling.`],
      ['Trail numbers', `The mapped route carries trail numbers 7, 7A. ${ORMA_SUGGESTION}`],
      ['Trail numbers and route', `The mapped route runs along numbered trails 7 and then 7A. ${READ_FROM_MAP}`],
      ['Where to switch', `On the mapped route, trail 7 gives way to trail 7A about 0.7 km from the start. ${OLD_MAP}`],
    ]);
    expect(lines).toEqual([
      ['Start', 'Start at the car park, marked on the map. Check current access before travelling.'],
      ['Trail numbers', 'The mapped route carries trail numbers 7, 7A.'],
      ['Trail numbers and route', 'The mapped route runs along numbered trails 7 and then 7A.'],
      ['Where to switch', 'On the mapped route, trail 7 gives way to trail 7A about 0.7 km from the start.'],
    ]);
    expect(note).toBe('The start and the trail numbers are ORMA’s suggestion. '
      + 'The route and where to switch are read off the map (OpenStreetMap). '
      + 'None of it was published by the trail’s operator.');
  });

  test('an operator\'s own directions carry no note', () => {
    const { lines, note } = splitSources([['Start', 'Start at the church.'], ['Route', 'Follow 20 round.']]);
    expect(note).toBe('');
    expect(lines).toEqual([['Start', 'Start at the church.'], ['Route', 'Follow 20 round.']]);
  });

  test('both trail page renderers use it, and the app bundle loads it before the trail page code', () => {
    const fs = require('fs');
    expect(fs.readFileSync('scripts/generate-trail-pages.js', 'utf8')).toContain('routeGuidanceSources.splitSources(');
    expect(fs.readFileSync('trail-blueprint.js', 'utf8')).toContain('DoloPawsRouteGuidanceSources.splitSources(');
    const bundle = fs.readFileSync('scripts/build-trail-page-bundle.js', 'utf8');
    expect(bundle.indexOf("'route-guidance-sources.js'")).toBeGreaterThan(-1);
    expect(bundle.indexOf("'route-guidance-sources.js'")).toBeLessThan(bundle.indexOf("'trail-blueprint.js'"));
  });
});
