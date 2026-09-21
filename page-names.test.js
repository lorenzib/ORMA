const fs = require('fs');
const path = require('path');
const { generatedDirectoryPattern } = require('./scripts/generated-directories');

// One place, one name. The catalogue answered to six — "Trails" in the nav,
// "Explore trails" in its own title, chip and heading, "Browse all Trails" in
// every footer, "All trails" in the trail breadcrumb, "Browse trails" on the
// profile page — and the safety section answered to two, with the static HTML
// saying one and the nav script repainting it to the other on every load.
//
// Naming the files to check is what let the verdict vocabulary drift twice, so
// this walks the tree instead of keeping a list.
const NAMES = [
  { file:'browse-trails.html', label:'Trails' },
  { file:'safety-guide.html', label:'Safety library' },
];

// One shared list of what a build writes, so this walker cannot go stale on
// its own the way the first one did.
const SKIP_DIRECTORIES = new RegExp(
  `^(?:${generatedDirectoryPattern()}|backoffice-data|docs|prototypes)(?:/|$)`
);

function shippedPages(){
  const pages = [];
  const walk = dir => {
    for(const entry of fs.readdirSync(dir, { withFileTypes:true })){
      const full = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if(SKIP_DIRECTORIES.test(full)) continue;
      if(entry.isDirectory()){ walk(full); continue; }
      if(entry.name.endsWith('.html')) pages.push(full);
    }
  };
  walk('.');
  return pages;
}

// The site header only. Footers are a sitemap and speak in sentences
// ("Browse all trails"), which is a different job from naming the place.
function topnavOf(source){
  const match = /<(?:div|header|nav)[^>]*class="[^"]*\btopnav\b[^"]*"[^>]*>([\s\S]*?)<\/(?:div|header|nav)>/.exec(source);
  return match ? match[1] : '';
}

describe('one place, one name', () => {
  const pages = shippedPages();

  test('there are pages to check at all', () => {
    expect(pages.length).toBeGreaterThan(150);
  });

  NAMES.forEach(({ file, label }) => {
    test(`every header calls ${file} "${label}"`, () => {
      const wrong = [];
      for(const page of pages){
        const nav = topnavOf(fs.readFileSync(page, 'utf8'));
        if(!nav) continue;
        const pattern = new RegExp(`<a[^>]*href="(?:\\.\\./|/)?${file.replace('.', '\\.')}"[^>]*>([^<]+)</a>`, 'g');
        for(const [, text] of nav.matchAll(pattern)){
          if(text.trim() !== label) wrong.push(`${page}: "${text.trim()}"`);
        }
      }
      expect(wrong).toEqual([]);
    });
  });

  test('the page names itself the way the header names it', () => {
    const browse = fs.readFileSync('browse-trails.html', 'utf8');
    expect(browse).toContain('<title>Trails, ORMA</title>');
    expect(browse).toContain('<span class="topnav-page">Trails</span>');
    expect(browse).toContain('<h1 id="trailCountHeading">Trails</h1>');

    const safety = fs.readFileSync('safety-guide.html', 'utf8');
    expect(safety).toContain('<span class="topnav-page">Safety library</span>');
    expect(safety).toContain('<h1>Safety library</h1>');
  });

  test('and so does every dictionary that has a word for it', () => {
    const i18n = fs.readFileSync('i18n.js', 'utf8');
    // Two keys for the safety link used to hold two different names, so the
    // label depended on which page you were reading it from.
    const english = i18n.slice(0, i18n.indexOf("'nav.browse': 'Esplora"));
    for(const key of ['saved.nav.safety', 'account.nav.safety']){
      expect(english).toContain(`'${key}': 'Safety library',`);
    }
    for(const key of ['saved.nav.browse', 'account.nav.browse']){
      expect(english).toContain(`'${key}': 'Trails',`);
    }
    expect(english).toContain("'browse.h1': 'Trails',");
  });

  test('the generator writes the same names, or regeneration undoes this', () => {
    const generator = fs.readFileSync(path.join('scripts', 'generate-trail-pages.js'), 'utf8');
    expect(generator).toContain('>Trails</a>');
    expect(generator).toContain('>Safety library</a>');
    expect(generator).not.toContain('>Safety guide</a>');
    expect(generator).not.toContain('>Browse all Trails</a>');
  });
});
