'use strict';

// The homepage, browse, about, scoring and contact pages have Italian copies
// under it/ that a search engine can find (scripts/italian-main-pages.js,
// written by scripts/generate-trail-pages.js). check-generated-artifacts keeps
// them in step with the English pages; this keeps them Italian and linked.

const fs = require('fs');
const path = require('path');
const { PAGES, italianCopy, italianLink } = require('./scripts/italian-main-pages');
const { dictionarySlices, entries } = require('./scripts/check-i18n-parity');

const slices = dictionarySlices(fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8'));
const EN = entries(slices.en);
const IT = entries(slices.it);

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const BASE = 'https://www.app-orma.com';

function visibleText(html){
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!-- TRAIL-INDEX-START[\s\S]*?TRAIL-INDEX-END -->/, '');
}

describe('Italian copies of the main pages', () => {
  test.each(Object.keys(PAGES))('%s has an Italian copy that says so', page => {
    const english = read(page);
    const italian = read(`it/${page}`);
    const meta = PAGES[page];
    expect(italian).toContain('<html lang="it" data-orma-lang="it">');
    expect(italian).toContain('<base href="/">');
    expect(italian).toContain(`<title>${meta.title}</title>`);
    expect(italian).toContain(`<link rel="canonical" href="${BASE}${meta.italianUrl}">`);
    for(const html of [english, italian]){
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="${BASE}${meta.url}">`);
      expect(html).toContain(`<link rel="alternate" hreflang="it" href="${BASE}${meta.italianUrl}">`);
      expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${BASE}${meta.url}">`);
    }
    // <base> comes before the first address in <head>.
    expect(italian.indexOf('<base href="/">')).toBeLessThan(italian.search(/\s(?:href|src)="/));
    expect(italian).not.toContain('data-lang-block="en"');
  });

  test.each(Object.keys(PAGES))('%s carries every data-i18n text in Italian', page => {
    const italian = visibleText(read(`it/${page}`));
    const english = visibleText(read(page));
    const leftovers = [...english.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]{4,})</g)]
      .filter(([, , text]) => /[A-Za-z]{3}/.test(text))
      .filter(([, key, text]) => italian.includes(`data-i18n="${key}"`) &&
        new RegExp(`data-i18n="${key}"[^>]*>${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`).test(italian));
    // A key whose Italian is the same word (Apple Maps, Email) stays as it is.
    expect(leftovers.map(([, key]) => key).filter(key => IT.get(key) !== EN.get(key))).toEqual([]);
  });

  test('the browse copy lists every walk by its Italian page', () => {
    const italian = read('it/browse-trails.html');
    const index = italian.slice(italian.indexOf('TRAIL-INDEX-START'), italian.indexOf('TRAIL-INDEX-END'));
    expect(index).not.toMatch(/href="trail\.html\?id=/);
    const links = [...index.matchAll(/href="\/it\/trails\/([\w-]+)\.html"/g)].map(match => match[1]);
    expect(links.length).toBeGreaterThan(400);
    links.forEach(slug => expect(fs.existsSync(path.join(root, 'it', 'trails', `${slug}.html`))).toBe(true));
  });

  test('the sitemap lists every Italian copy', () => {
    const sitemap = read('sitemap.xml');
    Object.values(PAGES).forEach(meta => expect(sitemap).toContain(`<loc>${BASE}${meta.italianUrl}</loc>`));
  });

  test('links to a page with an Italian copy go to the copy; code is left alone', () => {
    expect(italianLink('browse-trails.html#collections')).toBe('/it/browse-trails.html#collections');
    expect(italianLink('index.html')).toBe('/it/');
    expect(italianLink('guides/heat-overheating.html')).toBe('/it/guides/heat-overheating.html');
    expect(italianLink('journal.html')).toBeNull();
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>x</title>' +
      '<meta name="description" content="x"></head><body><a href="about.html">About</a>' +
      '<a href="journal.html">J</a><img src="logo.svg"><a href="#top">Top</a>' +
      '<script>el.innerHTML = \'<a href="\' + url + \'">x</a>\';</script></body></html>';
    const copy = italianCopy(html, 'about.html');
    expect(copy).toContain('<a href="/it/about.html">');
    expect(copy).toContain('<a href="/journal.html">');
    expect(copy).toContain('<img src="/logo.svg">');
    expect(copy).toContain('<a href="/it/about.html#top">');
    expect(copy).toContain('el.innerHTML = \'<a href="\' + url + \'">x</a>\';');
  });
});
