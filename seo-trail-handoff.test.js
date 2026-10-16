const fs = require('fs');
const path = require('path');

const root = __dirname;
const trailDirectory = path.join(root, 'trails');
const validationReport = require('./data/generated/trail-validation-report.json');
const html = name => fs.readFileSync(path.join(trailDirectory, name), 'utf8');
const all = fs.readdirSync(trailDirectory)
  .filter(name => name.endsWith('.html') && name !== 'index.html')
  .sort();
// A retired address is a page in this directory and is deliberately not a trail
// page: it redirects to the slug the trail moved to when its name was fixed.
// Both kinds are checked, each against what it is meant to be.
const isRedirect = name => /<meta http-equiv="refresh"/.test(html(name));
const redirects = all.filter(isRedirect);
const pages = all.filter(name => !isRedirect(name));

describe('SEO-01 generated trail handoff', () => {
  test('covers the complete published trail-page set', () => {
    expect(pages.length).toBe(validationReport.totals.published);
  });

  test('a retired address redirects rather than competing with the page', () => {
    // A fixed name moves the URL, and the old one keeps answering. It must not
    // read as a second page for the same walk: no index, a canonical pointing
    // at the real one, and a target that exists.
    for(const name of redirects){
      const body = html(name);
      const target = (body.match(/url=\.\/([a-z0-9-]+\.html)/) || [])[1];
      expect(target).toBeTruthy();
      expect(pages).toContain(target);
      expect(body).toContain(`<link rel="canonical" href="https://www.app-orma.com/trails/${target}">`);
      expect(body).toContain('<meta name="robots" content="noindex, follow">');
      // Not a trail page wearing a redirect: it carries no handoff of its own.
      expect(body).not.toContain('<a class="sp-cta"');
    }
  });

  test.each(pages)('%s preserves discovery and hands off to one interactive trail', filename => {
    const html = fs.readFileSync(path.join(trailDirectory, filename), 'utf8');
    const canonical = `https://www.app-orma.com/trails/${filename}`;
    const primary = html.match(/<a class="sp-cta" href="\.\.\/trail\.html\?id=([^"]+)">Open the full trail guide →<\/a>/g) || [];
    const primaryIndex = html.indexOf('<a class="sp-cta"');
    const articleIndex = html.indexOf('<div class="sp-body">');

    expect(html).toContain(`<link rel="canonical" href="${canonical}">`);
    expect(primary).toHaveLength(1);
    expect(decodeURIComponent(primary[0].match(/\?id=([^"]+)/)[1])).toMatch(/^[a-z0-9._-]{1,80}$/i);
    expect(primaryIndex).toBeGreaterThan(-1);
    expect(primaryIndex).toBeLessThan(articleIndex);
    expect(html).not.toMatch(/http-equiv="refresh"|location\.replace\s*\(/i);
  });
});
