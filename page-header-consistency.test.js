const fs = require('fs');
const path = require('path');

const pages = [
  'browse-trails.html',
  'collections.html',
  'safety-guide.html',
  'journal.html',
];

describe('primary section page headers', () => {
  test.each(pages)('%s uses the shared title and subtitle pattern', file => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, file), 'utf8');

    const header = document.querySelector('.section-page-head');
    expect(header).not.toBeNull();
    expect(header.querySelector(':scope > h1, :scope > .section-page-head__copy > h1')).not.toBeNull();
    expect(header.querySelector('.section-page-subtitle')).not.toBeNull();
  });

  test('the shared subtitle stays on one line', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toMatch(/\.section-page-subtitle\s*\{[^}]*white-space:nowrap;/s);
    expect(css).toMatch(/\.section-page-head h1\s*\{[^}]*font-size:38px;/s);
  });
});
