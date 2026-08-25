const fs = require('fs');
const path = require('path');

const GUIDE_FILES = [
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

const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

describe('shared Safety Library colour system', () => {
  test('defines every semantic guide colour at the shared root', () => {
    [
      '--safety-info:',
      '--safety-info-soft:',
      '--safety-safe:',
      '--safety-safe-soft:',
      '--safety-caution:',
      '--safety-caution-soft:',
      '--safety-stop:',
      '--safety-stop-soft:',
    ].forEach(token => expect(styles).toContain(token));
  });

  test.each(GUIDE_FILES)('%s requests the recovered shared stylesheet', name => {
    const html = fs.readFileSync(path.join(__dirname, 'guides', name), 'utf8');
    expect(html).toContain('../styles.css?v=20260825-2');
  });

  test('breed cards do not inherit the retired two-column guide-panel layout', () => {
    const html = fs.readFileSync(path.join(__dirname, 'guides', 'breed-group-caveats.html'), 'utf8');
    document.body.innerHTML = html;

    expect(document.querySelector('main').classList.contains('gp-layout')).toBe(false);
    expect([...document.querySelectorAll('.scan-card')]
      .every(card => !card.classList.contains('gp-section'))).toBe(true);
  });

  test('heat guide preserves neutral, safe and stop card treatments', () => {
    const html = fs.readFileSync(path.join(__dirname, 'guides', 'heat-overheating.html'), 'utf8');

    expect(html).toMatch(/\.hs-readiness\{[^}]*background:var\(--hs-card\)/s);
    expect(html).toMatch(/\.hs-symptoms\{[^}]*background:var\(--success-dim\)/s);
    expect(html).toMatch(/\.hs-action\{[^}]*background:var\(--hs-card\)/s);
    expect(html).toMatch(/\.hs-risk\{[^}]*background:var\(--hs-red\)/s);
  });
});
