'use strict';

const fs = require('fs');
const path = require('path');

// The dog-rules guide was Dolomites-only and now applies to any region, so it
// moved from guides/dog-rules-dolomites.html to a name without a place in it.
// Shared links to the old address must keep working, in both languages.
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('dog rules guide', () => {
  test.each([['', 'Dog rules in the mountains'], ['it/', 'Regole per i cani in montagna']])(
    '%sold address sends readers to the new one', (lang, title) => {
      const old = read(`${lang}guides/dog-rules-dolomites.html`);
      expect(old).toContain('<meta http-equiv="refresh" content="0; url=./dog-rules-in-the-mountains.html">');
      expect(old).toContain(`<link rel="canonical" href="https://www.app-orma.com/${lang}guides/dog-rules-in-the-mountains.html">`);
      expect(old).toContain('<meta name="robots" content="noindex, follow">');
      expect(read(`${lang}guides/dog-rules-in-the-mountains.html`)).toContain(`<h1 style="font-size:clamp(28px,5vw,38px);margin-top:14px;">${title}</h1>`);
    });

  test.each(['', 'it/'])('%sguide is not about one region', lang => {
    const html = read(`${lang}guides/dog-rules-in-the-mountains.html`);
    expect(html.split('<footer')[0]).not.toMatch(/<(?:title|h1|h2)[^>]*>[^<]*Dolomit/);
    // A short country list, not a region-by-region guide.
    expect(html).toContain('id="rulesCountryTitle"');
    expect(html).not.toMatch(/€\s?\d|\d\s?€/);
  });

  test('nothing links to the old address', () => {
    const pages = ['safety-guide.html', 'it/safety-guide.html', 'guides/breed-group-caveats.html',
      'guides/dogs-on-cable-cars.html', 'it/guides/breed-group-caveats.html', 'it/guides/dogs-on-cable-cars.html'];
    for (const page of pages) expect(read(page)).not.toContain('dog-rules-dolomites');
  });
});
