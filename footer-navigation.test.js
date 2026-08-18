const fs = require('fs');
const path = require('path');

function htmlFiles(directory){
  return fs.readdirSync(directory, { withFileTypes:true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => path.join(directory, entry.name));
}

describe('footer navigation', () => {
  function footerOf(file){
    const html = fs.readFileSync(file, 'utf8');
    const match = html.match(/<footer class="site-footer hp-footer">[\s\S]*?<\/footer>/);
    return match ? match[0] : '';
  }

  function publicFooterPages(){
    return [
      ...htmlFiles(__dirname),
      ...htmlFiles(path.join(__dirname, 'guides')),
      ...htmlFiles(path.join(__dirname, 'trails')),
    ].filter(file => footerOf(file));
  }

  test('every dog-care footer links to the breed-group caveats guide', () => {
    const pages = publicFooterPages().filter(file =>
      footerOf(file).includes('<div class="hp-footer-h">Caring for your dog</div>')
    );
    expect(pages.length).toBeGreaterThan(0);
    pages.forEach(file => {
      expect(footerOf(file)).toMatch(
        /href="(?:\.\.\/|\/)?guides\/breed-group-caveats\.html">Breed group caveats<\/a>/
      );
    });
  });

  test('every public footer links to scoring instead of the safety-guide index', () => {
    const pages = publicFooterPages();
    expect(pages.length).toBeGreaterThan(0);
    pages.forEach(file => {
      const footer = footerOf(file);
      expect(footer).toMatch(
        /href="(?:\.\.\/|\/)?how-scoring-works\.html">How scoring works<\/a>/
      );
      expect(footer).not.toMatch(
        /href="(?:\.\.\/|\/)?safety-guide\.html">Safety guide<\/a>/
      );
    });
  });

  test('every public page uses the same ordered footer navigation', () => {
    const expected = [
      ['how-scoring-works.html', 'How scoring works'],
      ['browse-trails.html', 'Browse all Trails'],
      ['collections.html', 'Collections'],
      ['compare.html', 'Compare trails'],
      ['guides/water-for-dogs-on-trail.html', 'Heat &amp; hydration'],
      ['guides/paw-protection.html', 'Paw protection'],
      ['guides/breed-group-caveats.html', 'Breed group caveats'],
      ['guides/alpine-plants-for-dogs.html', 'Alpine plants guide'],
      ['journal.html', 'My walk journal'],
      ['saved.html', 'Saved trails'],
      ['downloads.html', 'Downloaded trails'],
      ['walk.html', 'Record a walk'],
      ['about.html', 'Instagram'],
      ['about.html', 'Newsletter'],
      ['contact.html', 'Support'],
      ['about.html', 'About us'],
      ['contact.html', 'Contact'],
      ['privacy.html', 'Privacy'],
      ['terms.html', 'Terms'],
    ];

    publicFooterPages().forEach(file => {
      const links = [...footerOf(file).matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
        .map(([, href, label]) => [href.replace(/^\.\.\//, ''), label.trim()]);
      expect(links).toEqual(expected);
    });
  });

  test('every public footer loads the current balanced six-column stylesheet', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toContain('grid-template-columns:minmax(230px,1.35fr) repeat(5,minmax(0,max-content))');
    expect(css).toContain('.hp-footer-grid>div:last-child{justify-self:end;}');
    expect(css).toContain('max-width:calc(var(--wrap) - (2 * var(--wrap-gutter)))');

    publicFooterPages().forEach(file => {
      const html = fs.readFileSync(file, 'utf8');
      expect(html).not.toMatch(/hp-footer[^\n{]*hp-footer-grid[^\n{]*\{[^}]*grid-template-columns/);
    });

    publicFooterPages().forEach(file => {
      const html = fs.readFileSync(file, 'utf8');
      expect(html).toMatch(/href="(?:\.\.\/|\/)?styles\.css\?v=20260818-15"/);
    });
  });
});
