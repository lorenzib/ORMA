const fs = require('fs');
const path = require('path');

// GitHub Pages serves 404.html for a missing URL at any depth (/trails/x.html
// included), so every asset on it must be root-absolute. A relative path
// resolves inside the missing folder and 404s a second time.
describe('404 page', () => {
  const html = fs.readFileSync(path.join(__dirname, '404.html'), 'utf8');

  test('references every asset from the site root', () => {
    const refs = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg|png|jpe?g|webp)(?:\?[^"]*)?)"/g)].map(m => m[1]);
    expect(refs.length).toBeGreaterThan(3);
    const relative = refs.filter(ref => !/^(?:\/|https?:)/.test(ref));
    expect(relative).toEqual([]);
  });

  test('sends people home with a root link', () => {
    expect(html).toMatch(/href="\/"[^>]*>Back to Homepage/);
  });
});
