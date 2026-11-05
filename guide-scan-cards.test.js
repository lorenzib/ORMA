const fs = require('fs');
const path = require('path');

const GUIDE_FILES = [
  'breed-group-caveats.html',
  'dogs-at-rifugi.html',
];

function read(name) {
  return fs.readFileSync(path.join(__dirname, 'guides', name), 'utf8');
}

describe('scan-first safety guide layouts', () => {
  test.each(GUIDE_FILES)('%s presents its key guidance as cards', name => {
    const html = read(name);
    document.body.innerHTML = html;

    expect(html).toContain('guide-scan-cards.css?v=20260825-1');
    expect(document.querySelector('.scan-intro,.breed-check-experience')).not.toBeNull();
    expect(document.querySelectorAll('.scan-card').length).toBeGreaterThanOrEqual(3);
    expect(document.querySelector('.safety-sources')).not.toBeNull();
    expect(document.body.textContent).toContain('Last reviewed 25 August 2026');
  });

  test('rifugio policy is split into terrace, indoor and overnight decisions', () => {
    const html = read('dogs-at-rifugi.html');
    document.body.innerHTML = html;
    expect(html).toContain('Ask three separate questions');
    expect(html).toContain('<h3>Terrace</h3>');
    expect(html).toContain('<h3>Indoor dining</h3>');
    expect(html).toContain('<h3>Overnight</h3>');
    expect(document.querySelector('h1').textContent).toBe('Dogs at rifugi: call before you count on it');
    expect(document.title).toBe('Dogs at rifugi: call before you count on it | ORMA');
    expect(document.querySelectorAll('.scan-card')).toHaveLength(6);
    expect(document.querySelectorAll('.scan-step')).toHaveLength(3);
    expect(html).not.toContain('Use the hut as a checkpoint');
    expect(html).not.toContain('Four details prevent most surprises');
    expect(html).not.toContain('<table');
  });

  test('guardian-dog guidance runs spot, pasture, approach, after', () => {
    const html = read('livestock-guard-dogs.html');
    document.body.innerHTML = html;
    expect(document.querySelector('h1').textContent).toBe('Meeting a livestock guardian dog with your own dog');
    expect(document.title).toBe('Meeting a livestock guardian dog with your own dog | ORMA');
    const headings = Array.from(document.querySelectorAll('.guardian-section h2')).map(h => h.textContent);
    expect(headings).toEqual([
      'How to recognise guardian dogs',
      'Before you walk into a pasture',
      'If a guardian dog comes over',
      'After an incident',
    ]);
    expect(html).toContain('guide-scan-cards.css?v=20260825-1');
    expect(document.querySelector('.safety-sources')).not.toBeNull();
    expect(document.body.textContent).toContain('Last reviewed 5 November 2026');
    expect(html).toContain('Maremmano-Abruzzese');
    expect(html).toContain('French national guidance says to let go of the lead');
    expect(document.querySelectorAll('.guardian-steps > li')).toHaveLength(4);
    // Every section is one white card, and there is a single warning box.
    expect(document.querySelectorAll('.guardian-section > .guardian-content-card')).toHaveLength(4);
    expect(document.querySelectorAll('.scan-alert')).toHaveLength(1);
    expect(Array.from(document.querySelectorAll('.guardian-section-head')).every(head => !head.closest('.guardian-content-card'))).toBe(true);
    expect(html).not.toContain('Three moves, in order');
    expect(html).not.toContain('scan-grid');
    expect(html).not.toContain('Explore Savoie');
    expect(html).not.toContain('class="gp-steps"');
  });
});
