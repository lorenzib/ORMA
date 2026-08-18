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

  test('the shared subtitle stays on one desktop line and wraps on phones', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    // Desktop section introductions share the available content row. Phones
    // restore normal wrapping so the complete sentence remains readable.
    expect(css).toMatch(/\.section-page-subtitle\s*\{[^}]*white-space:nowrap;[^}]*text-wrap:nowrap;/s);
    expect(css).toMatch(/@media\(max-width:760px\)/);
    expect(css).toMatch(/\.section-page-subtitle\s*\{[^}]*white-space:normal;[^}]*text-wrap:pretty;/s);
    expect(css).not.toMatch(/\.section-page-subtitle\s*\{[^}]*text-overflow:ellipsis;/s);
    expect(css).toMatch(/\.section-page-head h1\s*\{[^}]*font-size:38px;/s);
  });
});
