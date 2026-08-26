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

  test('shows every concise trail check before a trait is selected', () => {
    const cards = [...document.querySelectorAll('[data-breed-trait]')];
    expect(cards).toHaveLength(13);
    expect(cards.every(card => !card.hidden)).toBe(true);
    expect(document.querySelector('[data-breed-status]').textContent).toBe('Showing all 13 trail checks.');
    expect(document.querySelector('[data-breed-reset]').hidden).toBe(true);
  });

  test('supports multiple trait selections and a clear action', () => {
    const airway = document.querySelector('[data-breed-filter="airway"]');
    const deepChest = document.querySelector('[data-breed-filter="deep"]');
    const reset = document.querySelector('[data-breed-reset]');

    airway.click();
    expect(airway.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[data-breed-trait]:not([hidden])')).toHaveLength(1);

    deepChest.click();
    expect(deepChest.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('[data-breed-trait]:not([hidden])')).toHaveLength(2);
    expect(document.querySelector('[data-breed-status]').textContent).toMatch(/Showing 2 of 13/);
    expect(reset.hidden).toBe(false);

    reset.click();
    expect(document.querySelectorAll('[data-breed-trait]:not([hidden])')).toHaveLength(13);
    expect([...document.querySelectorAll('[data-breed-filter]')]
      .every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true);
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
