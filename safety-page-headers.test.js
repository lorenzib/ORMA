/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const pages = [
  ['altitude-with-your-dog.html', 'altitude-with-your-dog-v1.jpg'],
  ['breed-group-caveats.html', 'breed-group-considerations-dogs-v3.jpg'],
  ['dogs-on-cable-cars.html', 'dogs-on-cable-cars-v5.jpg'],
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

    expect(css).toMatch(/\.safety-photo-header\.section-page-head\{[^}]*position:relative;[^}]*min-height:clamp\(330px,36vw,470px\)[^}]*width:100%;[^}]*max-width:none;[^}]*border-radius:0/s);
    expect(css).toMatch(/\.safety-photo-header\.section-page-head::before\{[^}]*linear-gradient/s);
    expect(css).toMatch(/\.safety-photo-header__image\{[^}]*object-fit:cover;[^}]*object-position:var\(--safety-photo-position\)/s);
    expect(css).toMatch(/@media\(max-width:760px\)[\s\S]*\.safety-photo-header\.section-page-head\{[^}]*min-height:350px/s);
  });

  test('the cable-car header applies a dog-centred focal zoom', () => {
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, 'guides', 'dogs-on-cable-cars.html'), 'utf8');
    const header = document.querySelector('.safety-photo-header');
    const image = header.querySelector('.safety-photo-header__image');
    const pageCss = document.querySelector('style').textContent;

    expect(pageCss).toMatch(/\.cg-hero\{--safety-photo-position:center 62%/);
    expect(pageCss).toMatch(/@media\(max-width:620px\)[\s\S]*\.cg-hero\{--safety-photo-position:center 72%/);
    expect(image.getAttribute('style')).toBe('inset:-8%;width:116%;height:116%;');
  });

  test('the redesigned Alpine plants guide uses a full-width photographic mosaic', () => {
    document.documentElement.innerHTML = fs.readFileSync(path.join(__dirname, 'guides', 'alpine-plants-for-dogs.html'), 'utf8');
    const css = fs.readFileSync(path.join(__dirname, 'alpine-plants-guide.css'), 'utf8');
    const header = document.querySelector('.apg-hero.section-page-head');

    expect(header).not.toBeNull();
    expect(header.querySelector('h1')).not.toBeNull();
    expect(header.querySelector('.section-page-subtitle')).not.toBeNull();
    expect(header.querySelector('.apg-hero-mosaic')).not.toBeNull();
    expect(header.querySelectorAll('.apg-hero-tile img')).toHaveLength(3);
    expect(css).toMatch(/\.apg-hero\.section-page-head\{[^}]*width:100%;[^}]*max-width:none;[^}]*margin:0/s);
  });
});
