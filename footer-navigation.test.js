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
      ['browse-trails.html', 'Browse all Trails'],
      ['collections.html', 'Collections'],
      ['compare.html', 'Compare trails'],
      ['how-scoring-works.html', 'How scoring works'],
      ['guides/water-for-dogs-on-trail.html', 'Heat &amp; hydration'],
      ['guides/paw-protection.html', 'Paw protection'],
      ['guides/breed-group-caveats.html', 'Breed group caveats'],
      ['guides/alpine-plants-for-dogs.html', 'Alpine plants guide'],
      ['journal.html', 'My walk journal'],
      ['saved.html', 'Saved trails'],
      ['downloads.html', 'Downloaded trails'],
      ['walk.html', 'Record a walk'],
      // Follow Us and Get the app are icon/badge links, so they carry no
      // text node and never appear in this list.
      ['about.html', 'About us'],
      ['contact.html', 'Contact'],
      ['privacy.html', 'Privacy'],
      ['terms.html', 'Terms'],
      // The stay-in-touch band renders after the column grid.
    ];

    publicFooterPages().forEach(file => {
      const links = [...footerOf(file).matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
        .map(([, href, label]) => [href.replace(/^\.\.\//, ''), label.trim()]);
      expect(links).toEqual(expected);
    });
  });

  test('every public footer loads the focused CTA and compact responsive stylesheet', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toContain('.dog-profile-banner__inner');
    expect(css).toContain('grid-template-columns:minmax(210px,1.3fr) repeat(4,minmax(100px,.7fr))');
    expect(css).toContain('.hp-footer-grid{grid-template-columns:1fr 1fr;}');
    expect(css).toContain('--wrap:1440px;');
    expect(css).toContain('--wrap-gutter:clamp(28px,4vw,52px);');
    expect(css).toContain('.wrap{max-width:var(--wrap);margin:0 auto;padding:0 var(--wrap-gutter);}');
    expect(css).toContain('.hp-footer-grid{width:100%;max-width:none;margin:0;');
    expect(css).toContain('.hp-footer-base{width:100%;max-width:none;margin:28px 0 0;');

    publicFooterPages().forEach(file => {
      const html = fs.readFileSync(file, 'utf8');
      expect(html).not.toMatch(/hp-footer[^\n{]*hp-footer-grid[^\n{]*\{[^}]*grid-template-columns/);
    });

    publicFooterPages().forEach(file => {
      const html = fs.readFileSync(file, 'utf8');
      const stylesVersion = '(?:20260821-[57]|20260823-[12345]|20260825-[12]|20260827-1|20260831-[23]|20260901-[16]|20260903-[12]|20260904-[12]|20260905-[12])';
      const navigationVersion = '(?:20260823-[12]|20260831-1|20260901-[245]|20260905-[12])';
      expect(html).toMatch(new RegExp(`href="(?:\\.\\.\\/|\\/)?styles\\.css\\?v=${stylesVersion}"`));
      expect(html).toMatch(new RegExp(`src="(?:\\.\\.\\/|\\/)?mobile-nav\\.js\\?v=${navigationVersion}"`));
    });
  });

  test('every public footer links only to channels that actually exist', () => {
    const pages = publicFooterPages();
    expect(pages.length).toBeGreaterThan(0);
    pages.forEach(file => {
      const footer = footerOf(file);
      // account.html localises its headings, so allow extra attributes.
      // Follow Us is a standalone band below the grid, not a column.
      expect(footer).toMatch(/<div class="hp-footer-connect">/);
      expect(footer).toMatch(/<span class="hp-footer-h"[^>]*>Follow Us<\/span>/);
      // Facebook, YouTube and TikTok were icons pointing at about.html. A dead
      // link undercuts the one thing this product sells, so they are gone until
      // the accounts exist.
      const channels = [...footer.matchAll(/aria-label="ORMA on ([^"]+)"/g)].map(([, name]) => name);
      expect(channels).toEqual(['Instagram']);
      expect(footer).not.toContain('about.html" aria-label="ORMA on');

      expect(footer).toContain(
        '<a href="https://www.instagram.com/app.orma/" target="_blank" rel="noopener" aria-label="ORMA on Instagram">'
      );
    });
  });

  test('offers a real install route instead of unreleased store listings', () => {
    const navigation = fs.readFileSync(path.join(__dirname, 'mobile-nav.js'), 'utf8');

    // There is no iOS or Android listing, so the badges are gone rather than
    // shown-but-disabled. The written instruction is true with no script at
    // all, and the button only appears where a real install prompt exists.
    publicFooterPages().forEach(file => {
      const footer = footerOf(file);
      expect(footer).not.toContain('app-store-badge');
      expect(footer).not.toContain('google-play-badge');
      expect(footer).toContain('data-orma-install');
      expect(footer).toMatch(/Add ORMA to your home screen/);
    });

    expect(navigation).toContain("window.addEventListener('beforeinstallprompt'");
    expect(navigation).toContain("window.addEventListener('appinstalled'");
    expect(navigation).not.toContain('data-coming-soon');
  });
});
