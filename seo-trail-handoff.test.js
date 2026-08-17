const fs = require('fs');
const path = require('path');

const root = __dirname;
const trailDirectory = path.join(root, 'trails');
const validationReport = require('./data/generated/trail-validation-report.json');
const pages = fs.readdirSync(trailDirectory)
  .filter(name => name.endsWith('.html') && name !== 'index.html')
  .sort();

describe('SEO-01 generated trail handoff', () => {
  test('covers the complete published trail-page set', () => {
    expect(pages.length).toBe(validationReport.totals.published);
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
