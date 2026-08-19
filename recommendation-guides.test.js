const guides = require('./recommendation-guides.js');
const fs = require('fs');
const path = require('path');

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
    ['trail.livestock.present', 'livestock'],
    ['trail.altitude.high', 'altitude'],
  ])('%s selects %s', (code, expected) => {
    expect(guides.select({ cautions:[{ code }] })[0].id).toBe(expected);
  });

  test('selects guide links from the cautions displayed in the dog-fit card', () => {
    expect(guides.selectIds(['livestock', 'heat', 'livestock', 'unknown'], 3)
      .map(guide => guide.id)).toEqual(['livestock', 'heat']);
  });
});

describe('breed-group guide navigation', () => {
  test('uses a left contents rail and matching semantic content sections', () => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, 'guides/breed-group-caveats.html'), 'utf8');
    const links = [...document.querySelectorAll('.gp-toc a')];
    const sections = [...document.querySelectorAll('.gp-section[id]')];

    expect(links).toHaveLength(7);
    expect(sections).toHaveLength(7);
    expect(links.map(link => link.getAttribute('href'))).toEqual(sections.map(section => `#${section.id}`));
    expect(document.querySelector('.gp-mobile-toc')).not.toBeNull();
  });
});
