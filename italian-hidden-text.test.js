/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Image descriptions, screen-reader labels, placeholders and tooltips are read
// aloud or shown even though most readers never see them. On a page that loads
// i18n.js, each one written in English needs a data-i18n-* key so i18n.js can
// swap it for Italian. Two places are covered another way: the footer (i18n.js
// translateFooter matches its English text) and data-lang-block="en" sections,
// which have an Italian twin.
const ROOT = __dirname;
const SKIP = /^(backoffice|community-moderation|trail-verify)/;
const HOOKS = { 'aria-label':'i18nAriaLabel', placeholder:'i18nPh', title:'i18nTitle', alt:'i18nAlt' };

function englishOnly(file){
  const doc = new JSDOM(fs.readFileSync(path.join(ROOT, file), 'utf8')).window.document;
  const found = [];
  doc.querySelectorAll('*').forEach(el => {
    if(el.closest('footer.site-footer, [data-lang-block], [lang="it"], template')) return;
    for(const [attribute, hook] of Object.entries(HOOKS)){
      const value = el.getAttribute(attribute);
      if(value && /[A-Za-z]/.test(value) && !el.dataset[hook]) found.push(`${file}: ${attribute}="${value}"`);
    }
  });
  return found;
}

describe('hidden text in Italian', () => {
  const pages = fs.readdirSync(ROOT)
    .filter(file => file.endsWith('.html') && !SKIP.test(file))
    .filter(file => /<script[^>]+src="i18n\.js/.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));

  test('every description, label and placeholder has an Italian key', () => {
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.flatMap(englishOnly)).toEqual([]);
  });

  test('i18n.js swaps image descriptions', () => {
    const source = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
    expect(source).toMatch(/\[data-i18n-alt\][\s\S]{0,120}setAttribute\('alt'/);
  });
});
