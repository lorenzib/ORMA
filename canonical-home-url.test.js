const fs = require('fs');
const path = require('path');

const root = __dirname;

function htmlFiles(directory){
  return fs.readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    if(entry.name === 'node_modules' || entry.name === '.git') return [];
    const target = path.join(directory, entry.name);
    if(entry.isDirectory()) return htmlFiles(target);
    return entry.name.endsWith('.html') ? [target] : [];
  });
}

describe('canonical homepage URL', () => {
  test('declares the clean public URL and normalizes direct index requests', () => {
    const homepage = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(homepage).toContain('<link rel="canonical" href="https://www.app-orma.com/">');
    expect(homepage).toContain("location.pathname === '/index.html'");
    expect(homepage).toContain("location.replace('/' + location.search + location.hash)");
  });

  test('public HTML never links visitors to index.html', () => {
    const legacyHomeLink = /href=["'](?:\.\.\/|\/)?index\.html(?:[?#"'])/;
    const offenders = htmlFiles(root)
      .filter(file => legacyHomeLink.test(fs.readFileSync(file, 'utf8')))
      .map(file => path.relative(root, file));
    expect(offenders).toEqual([]);
  });

  test('the trail-page generator keeps regenerated navigation canonical', () => {
    const generator = fs.readFileSync(path.join(root, 'scripts/generate-trail-pages.js'), 'utf8');
    expect(generator).toContain('<a class="brand" href="/">');
    expect(generator).toContain('href="/?view=login&amp;next=trails/${slug}.html"');
    expect(generator).not.toContain('href="../index.html');
  });
});
