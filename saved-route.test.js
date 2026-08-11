const fs = require('fs');
const path = require('path');

const root = __dirname;
const legacyHtml = fs.readFileSync(path.join(root, 'my-trails.html'), 'utf8');

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
});
