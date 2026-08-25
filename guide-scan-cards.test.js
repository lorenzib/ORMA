const fs = require('fs');
const path = require('path');

const GUIDE_FILES = [
  'breed-group-caveats.html',
  'dogs-at-rifugi.html',
  'livestock-guard-dogs.html',
];

function read(name) {
  return fs.readFileSync(path.join(__dirname, 'guides', name), 'utf8');
}

describe('scan-first safety guide layouts', () => {
  test.each(GUIDE_FILES)('%s presents its key guidance as cards', name => {
    const html = read(name);
    document.body.innerHTML = html;

    expect(html).toContain('guide-scan-cards.css?v=20260825-1');
    expect(document.querySelector('.scan-intro')).not.toBeNull();
    expect(document.querySelectorAll('.scan-card').length).toBeGreaterThanOrEqual(3);
    expect(document.querySelector('.safety-sources')).not.toBeNull();
    expect(document.body.textContent).toContain('Last reviewed 25 August 2026');
  });

  test('rifugio policy is split into terrace, indoor and overnight decisions', () => {
    const html = read('dogs-at-rifugi.html');
    expect(html).toContain('Three separate questions');
    expect(html).toContain('<h3>Terrace</h3>');
    expect(html).toContain('<h3>Indoor dining</h3>');
    expect(html).toContain('<h3>Overnight</h3>');
    expect(html).not.toContain('<table');
  });

  test('guardian-dog guidance separates prevention, approach and direct contact', () => {
    const html = read('livestock-guard-dogs.html');
    expect(html).toContain('You see the herd first');
    expect(html).toContain('A guardian approaches');
    expect(html).toContain('Direct dog-to-dog contact');
    expect(html).toContain('Explore Savoie advises releasing your dog');
    expect(html).not.toContain('class="gp-steps"');
  });
});
