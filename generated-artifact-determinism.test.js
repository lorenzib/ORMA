const fs = require('fs');
const path = require('path');

const root = __dirname;

describe('generated artifact dates', () => {
  test('sitemap uses the explicit trail-data release date', () => {
    const release = JSON.parse(fs.readFileSync(
      path.join(root, 'data', 'trail-data-release.json'),
      'utf8'
    ));
    expect(release).toMatchObject({ schemaVersion:1 });
    expect(release.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    const dates = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)]
      .map(match => match[1]);
    expect(dates.length).toBeGreaterThan(100);
    expect(new Set(dates)).toEqual(new Set([release.lastModified]));
  });

  test('generator does not derive sitemap dates from filesystem mtimes', () => {
    const generator = fs.readFileSync(
      path.join(root, 'scripts', 'generate-trail-pages.js'),
      'utf8'
    );
    const sitemapSection = generator.slice(
      generator.indexOf('function sitemap(urls)'),
      generator.indexOf('function updateBrowseIndex')
    );
    expect(sitemapSection).toContain('trail-data-release.json');
    expect(sitemapSection).not.toContain('statSync');
    expect(sitemapSection).not.toContain('Date.now');
  });

  test('generated trail pages reuse the live mobile-nav cache-busting token', () => {
    const generator = fs.readFileSync(
      path.join(root, 'scripts', 'generate-trail-pages.js'),
      'utf8'
    );
    const trailShell = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
    const generatorToken = generator.match(/mobile-nav\.js\?v=([^"]+)/);
    const trailShellToken = trailShell.match(/mobile-nav\.js\?v=([^"]+)/);
    expect(generatorToken && generatorToken[1]).toBe(trailShellToken && trailShellToken[1]);
  });
});
