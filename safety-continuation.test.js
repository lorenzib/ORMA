/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const safetyPages = [
  'alpine-plants-for-dogs.html',
  'altitude-with-your-dog.html',
  'breed-group-caveats.html',
  'dogs-at-rifugi.html',
  'dogs-on-cable-cars.html',
  'heat-overheating.html',
  'livestock-guard-dogs.html',
  'paw-protection.html',
  'water-for-dogs-on-trail.html',
];

function readPage(name) {
  const html = fs.readFileSync(path.join(__dirname, 'guides', name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Safety Library continuation component', () => {
  test.each(safetyPages)('%s ends with one complete continuation block', (name) => {
    const page = readPage(name);
    const blocks = page.querySelectorAll('.safety-continue');
    expect(blocks).toHaveLength(1);

    const block = blocks[0];
    const cards = block.querySelectorAll('.safety-continue__card');
    expect(block.querySelector('h2').textContent).toBe('Continue in the Safety Library');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('href')).not.toBe(name);
    expect(cards[1].getAttribute('href')).toBe('../safety-guide.html');
    expect(block.querySelector('.safety-continue__cta').getAttribute('href')).toBe('../browse-trails.html');
    expect(block.compareDocumentPosition(page.querySelector('footer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(page.querySelectorAll('.gp-cta')).toHaveLength(0);
  });

  test('the Safety Library articles and water-planning guide are all covered', () => {
    const library = readPage('../safety-guide.html');
    const linkedGuides = Array.from(library.querySelectorAll('.sg-guide-card'))
      .map(link => path.basename(link.getAttribute('href')));
    expect(new Set(safetyPages)).toEqual(new Set([...linkedGuides, 'water-for-dogs-on-trail.html']));
  });

  test('shared styles support desktop, compact and mobile layouts', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toContain('.safety-continue{');
    expect(css).toContain('grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;');
    expect(css).toContain('@media(max-width:760px)');
    expect(css).toContain('@media(max-width:560px)');
  });
});
