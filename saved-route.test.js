const fs = require('fs');
const path = require('path');

const root = __dirname;
const legacyHtml = fs.readFileSync(path.join(root, 'my-trails.html'), 'utf8');
const savedHtml = fs.readFileSync(path.join(root, 'saved.html'), 'utf8');

describe('SAVE-01 canonical saved-trails route', () => {
  test('legacy bookmarks hand off to the canonical saved page', () => {
    expect(legacyHtml).toContain('<meta name="robots" content="noindex">');
    expect(legacyHtml).toContain('<meta http-equiv="refresh" content="0;url=saved.html">');
    expect(legacyHtml).toContain('<link rel="canonical" href="https://www.dolopaws.com/saved.html">');
    expect(legacyHtml).toContain('<a href="saved.html"');
    expect(legacyHtml).toContain("window.location.replace('saved.html' + window.location.search + window.location.hash)");
    expect(legacyHtml).not.toContain("window.location.replace('index.html')");
  });

  test('maintained application files do not link back to the retired route', () => {
    const files = fs.readdirSync(root).filter(name => /\.(?:html|js)$/.test(name));
    const references = files
      .filter(name => name !== 'saved-route.test.js')
      .filter(name => fs.readFileSync(path.join(root, name), 'utf8').includes('href="my-trails.html'));

    expect(references).toEqual([]);
  });

  test('canonical page localizes every saved-list lifecycle state', () => {
    [
      'saved.title',
      'saved.subtitle',
      'saved.loading',
      'saved.empty.title',
      'saved.signedOut.title',
      'saved.error.title',
    ].forEach(key => expect(savedHtml).toContain(`data-i18n="${key}"`));
    expect(savedHtml).toContain("window.t('saved.card.remove')");
    expect(savedHtml).toContain("window.t('saved.card.removing')");
    expect(savedHtml).toContain("translate('saved.unavailable.many'");
    expect(savedHtml).toContain('DoloPawsRecommendationDecision.translatedMessage');
  });
});
