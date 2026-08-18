const fs = require('fs');
const path = require('path');

function htmlFiles(directory){
  return fs.readdirSync(directory, { withFileTypes:true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
    .map(entry => path.join(directory, entry.name));
}

describe('footer navigation', () => {
  test('every dog-care footer links to the breed-group caveats guide', () => {
    const pages = [
      ...htmlFiles(__dirname),
      ...htmlFiles(path.join(__dirname, 'guides')),
      ...htmlFiles(path.join(__dirname, 'trails')),
    ].filter(file => {
      const html = fs.readFileSync(file, 'utf8');
      return html.includes('<div class="hp-footer-h">Caring for your dog</div>');
    });
    expect(pages.length).toBeGreaterThan(0);
    pages.forEach(file => {
      expect(fs.readFileSync(file, 'utf8')).toMatch(
        /href="(?:\.\.\/|\/)?guides\/breed-group-caveats\.html">Breed group caveats<\/a>/
      );
    });
  });
});
