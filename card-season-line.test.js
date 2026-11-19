// The homepage card's season line and dog-rule note, and the trail page map
// brought closer to the homepage map (owner, 19 Nov).
const fs = require('fs');
const path = require('path');
const words = require('./trail-season-words');
const decision = require('./recommendation-decision');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const board = { recommended: { months: [6, 7, 8, 9, 10] } };

describe('the card season line', () => {
  test('in season says the best months, out of season says when it is back', () => {
    expect(words.seasonFit(board, 7)).toEqual({ out: false, lead: 'In season now', facts: 'best June to October', risks: '' });
    expect(words.seasonFit(board, 11)).toEqual({ out: true, lead: 'Out of season', facts: 'back in June', risks: '' });
    expect(words.seasonFit({ recommended: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } }, 3).facts).toBe('good all year');
    expect(words.seasonFit(undefined, 7)).toBeNull();
  });

  test('agrees with the Out of season tag', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(words.seasonFit(board, month).out).toBe(words.outOfSeason(board, month));
    }
  });

  test('names a dog risk this month', () => {
    const salty = { ...board, recommended: { months: [3, 4, 5, 6, 7, 8, 9, 10, 11] }, dogSeasons: [{ kind: 'salt', months: [11, 12, 1, 2] }] };
    expect(words.seasonFit(salty, 11).risks).toBe('This month: salted roads');
  });

  test('bestTime still reads the same', () => {
    expect(words.bestTime(board)).toBe('Best time: June to October');
    expect(words.bestRange(board, true)).toBe('Jun–Oct');
  });

  test('the card renders it, and the Italian is there', () => {
    const script = read('script.js');
    expect(script).toContain('function liSeasonFitHtml(trail)');
    expect(script).toContain('${fresh}${verdict}${season}${know}${noDogRule}${gap}');
    const it = read('i18n-phrases-it.js');
    ['In season now', 'best {range}', 'good all year', 'back in {month}', 'This month: {risks}',
      'No dog rule on record here. Check local signs.'].forEach(phrase => expect(it).toContain(`"${phrase}":`));
  });
});

describe('the card dog-rule note', () => {
  const recommendation = {
    category: 'strong-option', score: 90,
    hardStops: [], cautions: [{ code: 'trail.season.outside', message: 'Outside season.' }],
    unknowns: [{ code: 'trail.dog-access.unknown', message: 'Dog access is unknown.' }],
    positiveReasons: [], factors: [],
  };
  test('present() keeps each card line with its code', () => {
    const view = decision.present(recommendation, { dogName: 'Teo' });
    expect(view.cardTrailUnknownItems.map(item => item.code)).toEqual(['trail.dog-access.unknown']);
    expect(view.cardCautionItems.map(item => item.code)).toEqual(['trail.season.outside']);
  });

  test('an unknown dog rule is a quiet note, not an amber warning', () => {
    const script = read('script.js');
    expect(script).toContain("new Set(['trail.season.outside', 'trail.dog-access.unknown'])");
    expect(script).toContain('<p class="li-answer-note">');
  });
});

describe('the trail page map', () => {
  test('no unlabelled dots below the icon zoom', () => {
    expect(read('detail-pois.js')).not.toContain("'-layer-lowzoom'");
  });

  test('contours sit behind a Layers chip that starts off', () => {
    expect(read('trail.html')).toMatch(/id="contoursToggle"[^>]*aria-pressed="false"/);
    const trail = read('trail.js');
    expect(trail).toContain("document.getElementById('contoursToggle')");
    expect(trail).not.toMatch(/loadContour\(\)\s*\n\s*\.then\(\(\) => window\.ORMAMapStyle\.addContours\(map\)\)\s*\n\s*\.catch\(\(\) => \{\}\);/);
  });
});
