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
    const next = block.querySelector('.safety-continue__next');
    const allGuides = block.querySelector('.safety-continue__all');
    expect(block.tagName).toBe('NAV');
    expect(block.getAttribute('aria-label')).toBe('Continue in the Safety Library');
    expect(block.querySelectorAll('a')).toHaveLength(2);
    expect(next.querySelector('.safety-continue__label').textContent).toBe('Next guide');
    expect(next.getAttribute('href')).not.toBe(name);
    expect(allGuides.getAttribute('href')).toBe('../safety-guide.html');
    expect(block.querySelector('.safety-continue__cta')).toBeNull();
    expect(block.textContent).not.toMatch(/Browse trails for your dog/);
    expect(block.compareDocumentPosition(page.querySelector('footer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(page.querySelectorAll('.gp-cta')).toHaveLength(0);
  });

  test.each(safetyPages)('%s ends with sources, review date and veterinary caveat', (name) => {
    const page = readPage(name);
    const continuation = page.querySelector('.safety-continue');
    const sources = page.querySelectorAll('.safety-sources');

    expect(sources).toHaveLength(1);
    expect(sources[0].querySelector('summary strong').textContent).toBe('Sources and medical references');
    expect(sources[0].querySelector('summary').textContent).toMatch(/Last reviewed/);
    expect(sources[0].querySelector('.safety-sources__caveat').textContent).toBe(
      'This is general information, not a diagnosis or a substitute for veterinary care.'
    );
    expect(continuation.compareDocumentPosition(sources[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sources[0].compareDocumentPosition(page.querySelector('footer')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(page.querySelector('.section-page-head')?.textContent || '').not.toMatch(/reviewed/i);
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
    expect(css).toContain('display:flex;');
    expect(css).toContain('.safety-continue__next{');
    expect(css).toContain('.safety-continue__all{');
    expect(css).toContain('@media(max-width:760px)');
    expect(css).toContain('@media(max-width:560px)');
    expect(css).toContain('.safety-sources{');
  });
});
