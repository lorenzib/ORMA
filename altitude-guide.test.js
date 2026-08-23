/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'altitude-with-your-dog.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'altitude-guide.js'), 'utf8');

describe('altitude health and safety guide', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test('leads with health-first framing and no empty hero image', () => {
    expect(document.querySelector('h1').textContent).toMatch(/altitude changes the effort/i);
    expect(document.querySelector('.alt-subtitle').textContent).toMatch(/health check in motion/i);
    expect(document.querySelector('.gp-hero-photo')).toBeNull();
    expect(document.querySelector('.alt-meta').textContent).toMatch(/Last reviewed 23 August 2026/i);
  });

  test('presents three observable condition choices without a numerical risk score', () => {
    const choices = document.querySelectorAll('[data-altitude-state]');
    expect(choices).toHaveLength(3);
    expect(Array.from(choices).map(choice => choice.dataset.altitudeState)).toEqual(['normal', 'caution', 'emergency']);
    expect(document.querySelector('.alt-triage').textContent).toMatch(/does not diagnose altitude illness/i);
    expect(document.querySelector('.alt-triage').textContent).not.toMatch(/%/);
  });

  test.each([
    ['normal', /continue conservatively/i, /short and easy/i],
    ['caution', /stop ascending/i, /descend and finish the hike/i],
    ['emergency', /urgent action/i, /seek veterinary help/i],
  ])('renders %s guidance', (state, labelPattern, copyPattern) => {
    window.eval(script);
    document.querySelector(`[data-altitude-state="${state}"]`).click();
    expect(document.querySelector('[data-altitude-label]').textContent).toMatch(labelPattern);
    expect(document.querySelector('[data-altitude-result]').textContent).toMatch(copyPattern);
    expect(document.querySelector('[data-altitude-result]').dataset.tone).toBe(state);
    expect(document.querySelector(`[data-altitude-state="${state}"]`).getAttribute('aria-pressed')).toBe('true');
  });

  test('keeps emergency signs and descent action visible without interaction', () => {
    const signs = document.querySelector('.alt-signs').textContent;
    expect(signs).toMatch(/Laboured breathing at rest/i);
    expect(signs).toMatch(/Pale or bluish gums/i);
    expect(signs).toMatch(/Collapse, seizure or disorientation/i);
    expect(signs).toMatch(/descend immediately/i);
  });

  test('includes pre-trip veterinary flags and conservative first-day planning', () => {
    const page = document.querySelector('main').textContent;
    expect(page).toMatch(/heart or lung disease/i);
    expect(page).toMatch(/unexplained coughing/i);
    expect(page).toMatch(/Puppies, seniors and flat-faced dogs/i);
    expect(page).toMatch(/skip the ambitious route/i);
    expect(page).toMatch(/No human altitude medication/i);
  });

  test('links supporting references and related safety guides', () => {
    const sources = document.querySelector('.alt-sources');
    expect(sources.open).toBe(false);
    expect(sources.querySelectorAll('a')).toHaveLength(3);
    expect(sources.textContent).toMatch(/general information, not a diagnosis/i);
    expect(Array.from(document.querySelectorAll('.alt-next-card')).map(link => link.getAttribute('href'))).toEqual([
      'heat-overheating.html',
      'dogs-at-rifugi.html',
    ]);
  });
});
