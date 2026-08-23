/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const pages = [
  ['altitude-with-your-dog.html', 'altitude-with-your-dog-v1.jpg'],
  ['breed-group-caveats.html', 'breed-group-considerations-dogs-v3.jpg'],
  ['dogs-on-cable-cars.html', 'dogs-on-cable-cars-v3.jpg'],
  ['heat-overheating.html', 'heat-hydration-waterfall-v1.jpg'],
  ['paw-protection.html', 'paw-protection-forest-v1.jpg'],
  ['livestock-guard-dogs.html', 'livestock-guardian-dogs-v1.jpg'],
  ['dogs-at-rifugi.html', 'dogs-at-rifugi.jpg'],
];

describe('Safety Library article headers', () => {
  test.each(pages)('%s reuses its library-card photograph as the page header', (filename, imageName) => {
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, 'guides', filename), 'utf8');

    const header = document.querySelector('.safety-photo-header.section-page-head');
    const image = header && header.querySelector(':scope > .safety-photo-header__image');

    expect(header).not.toBeNull();
    expect(header.querySelector('h1')).not.toBeNull();
    expect(header.querySelector('.section-page-subtitle')).not.toBeNull();
    expect(image).not.toBeNull();
    expect(image.getAttribute('src')).toBe(`../images/editorial/safety-library/${imageName}`);
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('decoding')).toBe('async');
    expect(document.querySelectorAll(`img[src$="${imageName}"]`)).toHaveLength(1);
  });

  test('the shared treatment crops photographs, protects contrast, and compacts on mobile', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

    expect(css).toMatch(/\.safety-photo-header\.section-page-head\{[^}]*position:relative;[^}]*min-height:clamp\(330px,36vw,470px\)/s);
    expect(css).toMatch(/\.safety-photo-header\.section-page-head::before\{[^}]*linear-gradient/s);
    expect(css).toMatch(/\.safety-photo-header__image\{[^}]*object-fit:cover;[^}]*object-position:var\(--safety-photo-position\)/s);
    expect(css).toMatch(/@media\(max-width:760px\)[\s\S]*\.safety-photo-header\.section-page-head\{[^}]*min-height:350px/s);
  });

  test('the visual Alpine plants guide keeps its identification mosaic', () => {
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, 'guides', 'alpine-plants-for-dogs.html'), 'utf8');

    const header = document.querySelector('.apg-hero.section-page-head');
    expect(header).not.toBeNull();
    expect(header.querySelector('h1')).not.toBeNull();
    expect(header.querySelector('.section-page-subtitle')).not.toBeNull();
    expect(header.querySelectorAll('.apg-hero-mosaic img')).toHaveLength(3);
  });
});
