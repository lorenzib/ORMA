const fs = require('fs');
const path = require('path');

// i18n.js swaps the browser-tab title for Italian readers. A page that loads
// i18n.js but has no entry keeps its English tab title even when everything on
// it is in Italian. trail.html sets its own title from the walk's name.
const ROOT = __dirname;
const OWN_TITLE = new Set(['trail.html']);

function italianTitles(){
  const source = fs.readFileSync(path.join(ROOT, 'i18n.js'), 'utf8');
  const block = source.match(/const TITLES = \{([\s\S]*?)\};/);
  if(!block) throw new Error('TITLES map not found in i18n.js');
  const titles = {};
  for(const [, page, title] of block[1].matchAll(/'([^']*)':\s*'([^']*)'/g)) titles[page] = title;
  return titles;
}

function decode(text){
  return text.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&rsquo;/g, '’').replace(/&quot;/g, '"');
}

describe('Italian tab titles', () => {
  const titles = italianTitles();
  const pages = fs.readdirSync(ROOT)
    .filter(file => file.endsWith('.html') && !OWN_TITLE.has(file))
    .filter(file => /<script[^>]+src="i18n\.js/.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));

  test('every page that loads i18n.js has an Italian tab title', () => {
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.filter(page => !titles[page])).toEqual([]);
  });

  test('an /it/ copy and the swapped title agree', () => {
    // On /it/about.html the same map runs, so a different wording would make the
    // tab title change while the page loads.
    const differ = fs.readdirSync(path.join(ROOT, 'it'))
      .filter(file => file.endsWith('.html') && titles[file])
      .map(file => {
        const copy = fs.readFileSync(path.join(ROOT, 'it', file), 'utf8').match(/<title>([^<]*)<\/title>/);
        return { file, copy: copy && decode(copy[1]), swapped: titles[file] };
      })
      .filter(item => item.copy !== item.swapped);
    expect(differ).toEqual([]);
  });
});
