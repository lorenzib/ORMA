/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'dogs-on-cable-cars.html'), 'utf8');

describe('cable-car guide compact alignment', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test('keeps the muzzle-practice title on one line', () => {
    const css = document.querySelector('style').textContent;
    expect(document.querySelector('#muzzle-practice-title').textContent).toBe('Make the muzzle predict treats');
    expect(css).toMatch(/\.cg-muzzle-practice h2\{[^}]*white-space:nowrap/);
    expect(css).toMatch(/\.cg-muzzle-practice h2\{[^}]*font-size:clamp\(\.92rem,4\.6vw,1\.25rem\)/);
  });

  test('aligns every step number with its heading row', () => {
    const css = document.querySelector('style').textContent;
    const steps = [...document.querySelectorAll('.cg-step')];
    expect(steps.map(step => step.querySelector('h3').textContent)).toEqual([
      'Rehearse the full routine',
      'Visit without boarding',
      'Take the easiest ride',
    ]);
    expect(css).toMatch(/\.cg-step\{[^}]*grid-template-columns:25px minmax\(0,1fr\)/);
    expect(css).toMatch(/\.cg-step b\{[^}]*grid-row:1/);
    expect(css).toMatch(/\.cg-step h3\{[^}]*grid-row:1/);
  });
});
