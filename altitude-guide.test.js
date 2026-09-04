/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'altitude-with-your-dog.html'), 'utf8');
describe('altitude health and safety guide', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test('leads with health-first framing and the library image behind the header', () => {
    expect(document.querySelector('h1').textContent).toMatch(/altitude changes the effort/i);
    expect(document.querySelector('.alt-subtitle').textContent).toMatch(/altitude, exertion and heat can look alike/i);
    const hero = document.querySelector('.alt-hero.safety-photo-header .safety-photo-header__image');
    expect(hero.getAttribute('src')).toBe('../images/editorial/safety-library/altitude-with-your-dog-v1.jpg');
    expect(hero.getAttribute('alt')).toBe('');
    expect(hero.getAttribute('width')).toBe('1200');
    expect(hero.getAttribute('height')).toBe('800');
    expect(document.querySelector('.alt-meta').textContent).toMatch(/2 min guide/i);
    expect(document.querySelector('.alt-meta').textContent).not.toMatch(/reviewed/i);
    expect(document.querySelector('.alt-jump')).toBeNull();
  });

  test('opens with the altitude explanation followed by the veterinary caution', () => {
    const firstSection = document.querySelector('.alt-shell > section');
    expect(firstSection.id).toBe('why-altitude');
    expect(firstSection.textContent).toMatch(/Higher altitude means less available oxygen/i);
    expect(firstSection.textContent).toMatch(/Ask your vet before travelling/i);
    expect(firstSection.querySelector('.alt-context-copy').nextElementSibling.classList.contains('alt-vet-note')).toBe(true);
    expect(firstSection.querySelector('.alt-vet-note').classList.contains('alt-warning-note')).toBe(true);
    expect(firstSection.querySelector('.alt-vet-note strong')).toBeNull();
    expect(document.querySelector('.alt-triage')).toBeNull();
    expect(document.querySelector('script[src*="altitude-guide.js"]')).toBeNull();
  });

  test('keeps the medication guidance inside the veterinary warning', () => {
    const warning = document.querySelector('.alt-vet-note');
    expect(warning.classList.contains('alt-warning-note')).toBe(true);
    expect(warning.textContent).toMatch(/Ask your vet before travelling/i);
    expect(warning.textContent).toMatch(/No human altitude medication/i);
    expect(warning.textContent).toMatch(/Never give human altitude or pain medication/i);
    expect(document.querySelector('.alt-medication')).toBeNull();
  });

  test('includes pre-trip veterinary flags and conservative first-day planning', () => {
    const page = document.querySelector('main').textContent;
    expect(page).toMatch(/heart or lung disease/i);
    expect(page).toMatch(/coughing/i);
    expect(page).toMatch(/Puppies, seniors and flat-faced dogs/i);
    expect(page).toMatch(/skip the ambitious route/i);
    expect(page).toMatch(/No human altitude medication/i);
    expect(document.querySelectorAll('.alt-plan-panel')).toHaveLength(2);
    expect(document.querySelectorAll('.alt-plan-list li')).toHaveLength(4);
    expect(document.querySelector('.alt-health-grid')).toBeNull();
    expect(document.querySelector('.alt-timeline')).toBeNull();
  });

  test('places the first-day explanation directly below its title', () => {
    const head = document.querySelector('.alt-plan-head');
    expect(head.querySelector('h2').textContent).toBe('Keep the first day simple');
    expect(head.querySelector('h2').closest('div').nextElementSibling.textContent).toBe(
      'A fit dog can still struggle after a fast drive or lift ascent.'
    );
  });

  test('links supporting references and related safety guides', () => {
    const sources = document.querySelector('.safety-sources');
    expect(sources.open).toBe(false);
    // Sources are named in prose rather than linked out; the guarantee is that
    // the reader can still see what was consulted and that it is not advice.
    expect(sources.textContent).toMatch(/PetMD/);
    expect(sources.textContent).toMatch(/Platt Park Veterinary Hospital/);
    expect(sources.textContent).toMatch(/general information, not a diagnosis/i);
    expect(sources.querySelector('summary').textContent).toMatch(/Last reviewed 23 August 2026/i);
    expect(Array.from(document.querySelectorAll('.safety-continue a')).map(link => link.getAttribute('href'))).toEqual([
      'dogs-at-rifugi.html',
      'breed-group-caveats.html',
    ]);
  });
});
