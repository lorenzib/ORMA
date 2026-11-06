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
    expect(html).toContain('<h2 id="rifugioAccessTitle">Terrace, inside, overnight</h2>');
    expect(html).toContain('<h3>Terrace</h3>');
    expect(html).toContain('<h3>Inside</h3>');
    expect(html).toContain('<h3>Overnight</h3>');
    expect(document.querySelector('h1').textContent).toBe('Taking your dog to a rifugio');
    expect(document.title).toBe('Dogs at rifugi: taking your dog to a mountain hut | ORMA');
    expect(document.querySelectorAll('.scan-card')).toHaveLength(6);
    expect(document.querySelectorAll('.scan-step')).toHaveLength(3);
    expect(Array.from(document.querySelectorAll('.scan-step-number')).map(n => n.textContent)).toEqual(['1', '2', '3']);
    expect(html).not.toContain('Use the hut as a checkpoint');
    expect(html).not.toContain('Four details prevent most surprises');
    expect(html).not.toContain('<table');
  });

  test('guardian-dog guidance follows the heat guide pattern: what you see, steps, alert, afterwards', () => {
    const html = read('livestock-guard-dogs.html');
    document.body.innerHTML = html;
    expect(document.querySelector('h1').textContent).toBe('Livestock guardian dogs');
    expect(document.title).toBe('Livestock guardian dogs: meeting one with your dog | ORMA');
    expect(html).toContain('guide-scan-cards.css?v=20260825-1');
    expect(document.querySelector('.guide-quick')).not.toBeNull();
    expect(document.querySelector('.safety-sources')).not.toBeNull();
    expect(document.body.textContent).toContain('Last reviewed 5 November 2026');
    expect(Array.from(document.querySelectorAll('.hs-section h2')).map(h => h.textContent)).toEqual([
      'What you might see',
      'Stop, then back away',
      'After an incident',
    ]);
    expect(Array.from(document.querySelectorAll('.hs-observation-label')).map(l => l.textContent)).toEqual([
      'Signs of a flock',
      'Guardian dog in sight',
      'It comes over',
    ]);
    expect(document.querySelectorAll('.hs-actions')).toHaveLength(2);
    expect(document.querySelectorAll('.hs-action')).toHaveLength(6);
    expect(document.querySelectorAll('.scan-alert')).toHaveLength(1);
    expect(document.querySelector('.scan-alert strong').textContent).toBe('If a fight starts, let go of the lead');
    const sign = document.querySelector('.hs-section .guardian-sign');
    expect(sign.querySelector('img').getAttribute('src')).toBe('../images/editorial/safety-library/livestock-guardian-dog-sign-v1.jpg');
    expect(sign.querySelector('img').getAttribute('alt')).toMatch(/guardian dog/);
    expect(sign.querySelector('h3').textContent).toBe('What the sign says');
    expect(sign.querySelectorAll('ol > li')).toHaveLength(3);
    const italian = fs.readFileSync(path.join(__dirname, 'it', 'guides', 'livestock-guard-dogs.html'), 'utf8');
    expect(italian).toContain('src="../../images/editorial/safety-library/livestock-guardian-dog-sign-v1.jpg"');
    expect(fs.existsSync(path.join(__dirname, 'images', 'editorial', 'safety-library', 'livestock-guardian-dog-sign-v1.jpg'))).toBe(true);
    expect(html).toContain('Maremmano-Abruzzese');
    expect(html).toContain('French national guidance says to let go of the lead');
    expect(html).not.toContain('guardian-section');
    expect(html).not.toContain('guardian-stage');
    expect(html).not.toContain('scan-grid');
  });
});
