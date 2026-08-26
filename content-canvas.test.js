const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('shared website content canvas', () => {
  test('uses the canonical Collections width and gutters on desktop and mobile', () => {
    const css = read('styles.css');

    expect(css).toContain('--wrap:1440px;');
    expect(css).toContain('--wrap-gutter:clamp(28px,4vw,52px);');
    expect(css).toMatch(/\[class\]\.content-canvas\{[^}]*max-width:var\(--wrap\);[^}]*padding-left:var\(--wrap-gutter\);[^}]*padding-right:var\(--wrap-gutter\);/s);
    expect(css).toMatch(/@media\(max-width:760px\)[\s\S]*\[class\]\.content-canvas\{padding-left:16px;padding-right:16px;/s);
  });

  test('applies the canvas to Collections list and detail content', () => {
    document.body.innerHTML = read('collections.html');
    expect(document.querySelector('.collections-intro').classList.contains('content-canvas')).toBe(true);
    expect(document.querySelector('.collections-wrap').classList.contains('content-canvas')).toBe(true);

    const detailScript = read('collection-detail.js');
    expect(detailScript).toContain('collection-detail-hero__overlay content-canvas');
    expect(detailScript).toContain('collection-detail-content content-canvas');
  });

  test.each([
    ['guides/alpine-plants-for-dogs.html', '.apg-wrap'],
    ['guides/altitude-with-your-dog.html', '.alt-shell'],
    ['guides/breed-group-caveats.html', '.scan-shell'],
    ['guides/dogs-at-rifugi.html', '.gp-body'],
    ['guides/dogs-on-cable-cars.html', '.cg-shell'],
    ['guides/heat-overheating.html', '.gp-body'],
    ['guides/livestock-guard-dogs.html', '.gp-body'],
    ['guides/paw-protection.html', '.paw2-shell'],
    ['guides/water-for-dogs-on-trail.html', '.gp-body'],
  ])('%s applies the shared canvas to its main content', (file, selector) => {
    document.body.innerHTML = read(file);
    expect(document.querySelector(selector).classList.contains('content-canvas')).toBe(true);
  });
});
