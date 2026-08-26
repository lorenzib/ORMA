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
const guideSystem = fs.readFileSync(path.join(__dirname, 'guides', 'safety-guide-system.css'), 'utf8');
const libraryHtml = fs.readFileSync(path.join(__dirname, 'safety-guide.html'), 'utf8');

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

  test('heat guide uses white sections, blue selections, pale-red alerts and white numbered actions', () => {
    const html = fs.readFileSync(path.join(__dirname, 'guides', 'heat-overheating.html'), 'utf8');

    expect(html).toMatch(/\.hs-risk\{[^}]*background:[^;]*var\(--hs-red\)/s);
    expect(guideSystem).toMatch(/\.hs-readiness[^}]*\.hs-observation[^}]*background:var\(--card\)/s);
    expect(guideSystem).toMatch(/\.hs-check:has\(input:checked\)[^}]*background:var\(--safety-info-soft\)/s);
    expect(guideSystem).toMatch(/\.hs-risk[^}]*background:var\(--safety-stop-soft\)/s);
    expect(guideSystem).toMatch(/\.hs-action[^}]*background:var\(--card\)/s);
    expect(guideSystem).toMatch(/\.hs-action::before[^}]*background:var\(--safety-safe\)/s);
  });

  test('the library keeps its categories while presenting every guide card in one colour', () => {
    document.body.innerHTML = libraryHtml;
    const assignments = [...document.querySelectorAll('.sg-category')]
      .map(category => ({
        heading:category.querySelector('h2').textContent,
        tone:category.dataset.tone,
        cards:category.querySelectorAll('.sg-guide-card').length,
      }));

    expect(assignments).toEqual([
      { heading:'Before you leave', tone:'info', cards:3 },
      { heading:'On the trail', tone:'caution', cards:3 },
      { heading:'Shared spaces', tone:'safe', cards:2 },
    ]);
    expect(libraryHtml).not.toContain('.sg-category[data-tone="caution"]');
    expect(libraryHtml).not.toContain('.sg-category[data-tone="safe"]');
    expect(libraryHtml).toContain('.sg-guide-card{');
    expect(libraryHtml).toContain('background:var(--sg-tone-soft)');
    expect(libraryHtml).toContain('border:1px solid var(--sg-tone-border)');
  });
});
