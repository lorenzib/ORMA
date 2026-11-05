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

  test('guardian-dog guidance runs as green, amber and red stages, then afterwards', () => {
    const html = read('livestock-guard-dogs.html');
    document.body.innerHTML = html;
    expect(document.querySelector('h1').textContent).toBe('Meeting a livestock guardian dog with your own dog');
    expect(document.title).toBe('Meeting a livestock guardian dog with your own dog | ORMA');
    expect(html).toContain('guide-scan-cards.css?v=20260825-1');
    expect(document.querySelector('.guide-quick')).not.toBeNull();
    expect(document.querySelector('.safety-sources')).not.toBeNull();
    expect(document.body.textContent).toContain('Last reviewed 5 November 2026');
    const stages = Array.from(document.querySelectorAll('.guardian-stage'));
    expect(stages.map(stage => stage.className.match(/guardian-stage--(\w+)/)[1])).toEqual(['green', 'amber', 'red', 'after']);
    expect(stages.map(stage => stage.querySelector('h2').textContent)).toEqual([
      'Lead on, go wide',
      'Stop, don’t stare, back away',
      'Let go of the lead',
      'After an incident',
    ]);
    expect(html).toContain('Maremmano-Abruzzese');
    expect(html).toContain('French national guidance says to let go of the lead');
    expect(document.querySelectorAll('.guardian-stage--amber .guardian-steps > li')).toHaveLength(4);
    // The red stage is the only warning; no separate alert box.
    expect(document.querySelectorAll('.scan-alert')).toHaveLength(0);
    expect(html).not.toContain('Three moves, in order');
    expect(html).not.toContain('scan-grid');
    expect(html).not.toContain('class="gp-steps"');
  });
});
