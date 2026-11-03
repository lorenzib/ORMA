const fs = require('fs');
const path = require('path');
const parity = require('./scripts/check-i18n-parity.js');

// Eighteen public pages once ignored the language choice: ten never loaded
// i18n.js, and the shared footer stayed English everywhere. These keep a page
// from dropping out of Italian again.

const PUBLIC_PAGES = [
  '404', 'about', 'account', 'browse-trails', 'collections', 'compare',
  'contact', 'downloads', 'how-scoring-works', 'index', 'journal', 'my-trails',
  'notifications', 'onboarding', 'photo-upload', 'profile', 'reviews',
  'route-planner', 'saved', 'settings', 'trail-report', 'trail', 'walk',
];

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
  .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

describe('Italian reaches every public page', () => {
  test.each(PUBLIC_PAGES)('%s.html loads i18n.js', page => {
    expect(read(`${page}.html`)).toMatch(/<script src="\/?i18n\.js[?"]/);
  });

  test('every text in the shared footer has a footer entry', () => {
    const { en } = parity.audit(__dirname);
    const known = new Set([...en].filter(([key]) => key.startsWith('footer.')).map(([, value]) => plain(value)));
    const footer = read('compare.html').match(/<footer class="site-footer hp-footer">[\s\S]*?<\/footer>/)[0]
      .replace(/<svg[\s\S]*?<\/svg>/g, '');
    const texts = [...footer.matchAll(/>([^<]*[A-Za-z][^<]*)</g)].map(match => plain(match[1]))
      .filter(text => text && text !== 'ORMA');
    expect(texts.length).toBeGreaterThan(20);
    texts.forEach(text => expect(known).toContain(text));
  });

  test('text a script has already filled is not overwritten on load', () => {
    const source = read('i18n.js');
    expect(source).toMatch(/if \(el\.id && I18N\.en\[el\.dataset\.i18n\] !== undefined &&\s+plainText\(el\.innerHTML\) !== plainText\(I18N\.en\[el\.dataset\.i18n\]\)\) return;/);
  });
});
