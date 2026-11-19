'use strict';

// Every guide a search engine may index is in sitemap.xml, in English and, when
// it has one, in its Italian copy. Heat, paw protection, breed and build, and
// altitude were missing for months because the list was written by hand.

const fs = require('fs');
const path = require('path');

const BASE = 'https://www.app-orma.com';
const sitemap = fs.readFileSync(path.join(__dirname, 'sitemap.xml'), 'utf8');

const guides = fs.readdirSync(path.join(__dirname, 'guides'))
  .filter(file => file.endsWith('.html'))
  .filter(file => {
    const html = fs.readFileSync(path.join(__dirname, 'guides', file), 'utf8');
    return !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  });

describe('sitemap lists every guide', () => {
  test('there are guides to check', () => {
    expect(guides.length).toBeGreaterThan(10);
  });

  test.each(guides)('guides/%s is in the sitemap', file => {
    expect(sitemap).toContain(`<loc>${BASE}/guides/${file}</loc>`);
    if (fs.existsSync(path.join(__dirname, 'it', 'guides', file))) {
      expect(sitemap).toContain(`<loc>${BASE}/it/guides/${file}</loc>`);
    }
  });
});
