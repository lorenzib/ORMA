// A card carries one verdict; the trail's risk is the "Watch" line under it.
const verdict = require('./match-verdict.js');

const trust = { categoryVerified: () => true };
const en = { lang: 'en', trailText: text => text };

describe('the card Watch line', () => {
  test('a low-risk trail has nothing to watch', () => {
    expect(verdict.cardWatch({ safetyLevel: 'low-risk', surfaceHazards: ['Roots'] }, null, { trust, i18n: en })).toBe('');
  });

  test('the trail’s own hazard words come first, an exposed one before the rest', () => {
    const trail = { safetyLevel: 'caution', exposure: true, surfaceHazards: ['Sharp limestone', 'Narrow ledges with drop-offs'] };
    expect(verdict.cardWatch(trail, null, { trust, i18n: en })).toBe('Narrow ledges with drop-offs');
  });

  test('Italian without a translation gets the plain sentence, not English', () => {
    const it = { lang: 'it', trailText: text => text };
    const trail = { safetyLevel: 'caution', surfaceHazards: ['Sharp limestone'] };
    const t = key => ({ 'card.watch.caution': 'Un sentiero a rischio più alto: controlla i pericoli prima di partire.' })[key] || key;
    expect(verdict.cardWatch(trail, null, { trust, i18n: it, translate: t }))
      .toBe('Un sentiero a rischio più alto: controlla i pericoli prima di partire.');
  });

  test('unreviewed hazards are not stated; the plain sentence stands in', () => {
    const trail = { safetyLevel: 'moderate', surfaceHazards: ['Loose scree'] };
    expect(verdict.cardWatch(trail, null, { trust: { categoryVerified: () => false }, i18n: en }))
      .toBe('A moderate-risk trail: read the cautions before you go.');
  });
});
