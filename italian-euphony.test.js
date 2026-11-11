/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

// i18n.js on an Italian page, with the phrase table it would fetch.
function italianPhrase() {
  document.documentElement.setAttribute('data-orma-lang', 'it');
  require('./i18n-phrases-it.js');
  window.eval(fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8'));
  return window.DoloPawsI18n;
}

describe('Italian "ad" before aprile and agosto', () => {
  test('the app says "da marzo ad aprile" and "torna ad agosto", but "a ottobre"', () => {
    const i18n = italianPhrase();
    expect(i18n.lang).toBe('it');
    expect(i18n.phrase('{from} to {to}', { from: 'marzo', to: 'aprile' })).toBe('da marzo ad aprile');
    expect(i18n.phrase('Out of season · back in {month}', { month: 'agosto' })).toBe('Fuori stagione · torna ad agosto');
    expect(i18n.phrase('{from} to {to}', { from: 'maggio', to: 'ottobre' })).toBe('da maggio a ottobre');
    expect(i18n.phrase('Out of season · back in {month}', { month: 'apr' })).toBe('Fuori stagione · torna ad apr');
    expect(i18n.phrase('Out of season · back in {month}', { month: 'giu' })).toBe('Fuori stagione · torna a giu');
  });

  test('the static pages carry no "a aprile" or "a agosto"', () => {
    const dir = path.join(__dirname, 'it', 'trails');
    const bad = fs.readdirSync(dir).filter((file) => file.endsWith('.html'))
      .filter((file) => /(^|[^\p{L}])[Aa] [Aa](prile|gosto|pr|go)\b/u.test(fs.readFileSync(path.join(dir, file), 'utf8')));
    expect(bad).toEqual([]);
  });

  test('both places use the same rule', () => {
    const rule = /\.replace\(\/\(\^\|\[\^\\p\{L\}\]\)\(\[Aa\]\) \(\[Aa\]\(\?:prile\|gosto\|pr\|go\)\)\\b\/gu, '\$1\$2d \$3'\)/;
    expect(fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8')).toMatch(rule);
    expect(fs.readFileSync(path.join(__dirname, 'scripts', 'generate-trail-pages.js'), 'utf8')).toMatch(rule);
  });
});
