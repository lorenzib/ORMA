const guides = require('./recommendation-guides.js');

describe('GUIDE-01 contextual caution guides', () => {
  test('selects, deduplicates, and caps guides from stable caution codes', () => {
    const selected = guides.select({
      hardStops:[],
      cautions:[
        { code:'trail.heat.high' },
        { code:'trail.shade.very-low' },
        { code:'trail.water.none-reviewed' },
        { code:'trail.surface-hazards.present' },
      ],
    });

    expect(selected.map(guide => guide.id)).toEqual(['heat', 'water']);
  });

  test('does not manufacture links for unrelated cautions or unknowns', () => {
    expect(guides.select({
      cautions:[{ code:'trail.distance.above-range' }],
      unknowns:[{ code:'trail.water.unknown' }],
    })).toEqual([]);
  });

  test.each([
    ['conditions.heat.moderate', 'heat'],
    ['trail.water.none-reviewed', 'water'],
    ['trail.descent.joint-load', 'paws'],
    ['trail.exposure.present', 'exposure'],
  ])('%s selects %s', (code, expected) => {
    expect(guides.select({ cautions:[{ code }] })[0].id).toBe(expected);
  });
});
