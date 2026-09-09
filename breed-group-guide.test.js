/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'breed-group-caveats.html'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, 'breed-group-guide.js'), 'utf8');

describe('interactive breed and build guide', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
    window.eval(controller);
  });

  test('shows all 13 breed cards in their compact state', () => {
    const cards = [...document.querySelectorAll('[data-breed-trait]')];
    expect(cards).toHaveLength(13);
    expect(document.querySelectorAll('[data-breed-card-toggle]')).toHaveLength(13);
    expect(document.querySelectorAll('.breed-card-summary')).toHaveLength(13);
    expect(cards.every(card => card.classList.contains('is-enhanced'))).toBe(true);
    expect(cards.every(card => card.querySelector('.breed-card-content').hidden)).toBe(true);
  });

  test('keeps every trait title and breed example directly beside its image', () => {
    const summaries = [...document.querySelectorAll('.breed-card-summary')];
    expect(summaries).toHaveLength(13);
    expect(summaries.every(summary => summary.children[0].matches('.breed-card-image'))).toBe(true);
    expect(summaries.every(summary => summary.querySelector('.breed-card-summary__copy > h2'))).toBe(true);
    expect(summaries.every(summary => summary.querySelector('.breed-card-summary__copy > .scan-examples'))).toBe(true);
  });

  test('gives every card a lightweight, non-diagnostic visual example', () => {
    const images = [...document.querySelectorAll('.breed-card-image')];
    expect(images).toHaveLength(13);
    expect(images.every(image => image.getAttribute('loading') === 'lazy')).toBe(true);
    expect(images.every(image => image.getAttribute('alt') === '')).toBe(true);
    expect(images.every(image => fs.existsSync(path.resolve(__dirname, 'guides', image.getAttribute('src')))))
      .toBe(true);
  });

  test('keeps the emergency and breed cards together without a separate selector', () => {
    const experience = document.querySelector('.breed-check-experience');
    expect(experience).not.toBeNull();
    expect(experience.firstElementChild.classList.contains('breed-emergency')).toBe(true);
    expect(experience.querySelector('.breed-picker')).toBeNull();
    expect(experience.querySelector('[data-breed-grid]')).not.toBeNull();
  });

  test('turns multiple cards independently and exposes the guidance accessibly', () => {
    const airway = document.querySelector('[data-breed-trait="airway"]');
    const deepChest = document.querySelector('[data-breed-trait="deep"]');
    const airwayToggle = airway.querySelector('[data-breed-card-toggle]');
    const deepChestToggle = deepChest.querySelector('[data-breed-card-toggle]');

    airwayToggle.click();
    expect(airway.classList.contains('is-open')).toBe(true);
    expect(airwayToggle.getAttribute('aria-expanded')).toBe('true');
    expect(airwayToggle.getAttribute('aria-label')).toMatch(/Flat or short nose/);
    expect(airway.querySelector('.breed-card-content').hidden).toBe(false);

    deepChestToggle.click();
    expect(deepChest.classList.contains('is-open')).toBe(true);
    expect(airway.classList.contains('is-open')).toBe(true);

    airwayToggle.click();
    expect(airway.classList.contains('is-open')).toBe(false);
    expect(airwayToggle.getAttribute('aria-expanded')).toBe('false');
  });

  test('turns a closed card when its visible front is clicked', () => {
    const card = document.querySelector('[data-breed-trait="coat"]');
    card.querySelector('h2').click();
    expect(card.classList.contains('is-open')).toBe(true);
  });

  test('keeps the source-backed medical edge cases explicit', () => {
    const text = document.querySelector('main').textContent;
    expect(text).toMatch(/gastric dilatation-volvulus/i);
    expect(text).toMatch(/intervertebral disc/i);
    expect(text).toMatch(/exercise-induced collapse/i);
    expect(text).toMatch(/laryngeal paralysis/i);
    expect(text).toMatch(/grass awns/i);
    expect(text).toMatch(/Last reviewed 25 August 2026/i);
  });
});
