const fs = require('fs');
const path = require('path');

const pages = [
  'browse-trails.html',
  'collections.html',
  'safety-guide.html',
  'journal.html',
];

const editorialPages = [
  'about.html',
  'contact.html',
  'privacy.html',
  'terms.html',
  'how-scoring-works.html',
  'compare.html',
  'guides/alpine-plants-for-dogs.html',
  'guides/altitude-with-your-dog.html',
  'guides/breed-group-caveats.html',
  'guides/dog-friendly-hikes-lago-di-braies.html',
  'guides/dog-friendly-hikes-val-gardena.html',
  'guides/dogs-at-rifugi.html',
  'guides/dogs-on-cable-cars.html',
  'guides/heat-overheating.html',
  'guides/livestock-guard-dogs.html',
  'guides/paw-protection.html',
  'guides/water-for-dogs-on-trail.html',
];

describe('primary section page headers', () => {
  test.each(pages)('%s uses the shared title and subtitle pattern', file => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, file), 'utf8');

    const header = document.querySelector('.section-page-head');
    expect(header).not.toBeNull();
    expect(header.querySelector(':scope > h1, :scope > .section-page-head__copy > h1')).not.toBeNull();
    expect(header.querySelector('.section-page-subtitle')).not.toBeNull();
  });

  test('the shared subtitle stays on one desktop line and wraps on phones', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    // Desktop section introductions share the available content row. Phones
    // restore normal wrapping so the complete sentence remains readable.
    expect(css).toMatch(/\.section-page-subtitle\s*\{[^}]*white-space:nowrap;[^}]*text-wrap:nowrap;/s);
    expect(css).toMatch(/@media\(max-width:760px\)/);
    expect(css).toMatch(/\.section-page-subtitle\s*\{[^}]*white-space:normal;[^}]*text-wrap:pretty;/s);
    expect(css).not.toMatch(/\.section-page-subtitle\s*\{[^}]*text-overflow:ellipsis;/s);
    expect(css).toMatch(/\.section-page-head h1\s*\{[^}]*font-size:38px;/s);
  });

  test.each(['collections.html', 'safety-guide.html', 'journal.html'])('%s follows the Browse trails horizontal canvas', file => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, file), 'utf8');

    expect(document.querySelector('.section-page-head').classList.contains('browse-canvas-head')).toBe(true);
    expect(document.querySelector('.section-page-wrap').classList.contains('browse-canvas-wrap')).toBe(true);
  });

  test('the Browse canvas preserves its desktop and mobile gutters', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toMatch(/\[class\]\.section-page-head\.browse-canvas-head\{[^}]*max-width:1680px;[^}]*padding-left:clamp\(24px,3vw,44px\);[^}]*padding-right:clamp\(24px,3vw,44px\);/s);
    expect(css).toMatch(/\[class\]\.section-page-wrap\.browse-canvas-wrap\{[^}]*max-width:1680px;[^}]*padding-left:clamp\(24px,3vw,44px\);[^}]*padding-right:clamp\(24px,3vw,44px\);/s);
    expect(css).toMatch(/@media\(max-width:760px\)[\s\S]*\[class\]\.section-page-head\.browse-canvas-head\{padding-left:18px;padding-right:18px;\}/);
    expect(css).toMatch(/@media\(max-width:760px\)[\s\S]*\[class\]\.section-page-wrap\.browse-canvas-wrap\{padding-left:16px;padding-right:16px;\}/);
  });

  test.each(editorialPages)('%s uses the same outer title and description margins', file => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, file), 'utf8');

    const header = document.querySelector('.section-page-head');
    expect(header).not.toBeNull();
    expect(header.querySelector('h1')).not.toBeNull();
    expect(header.querySelector('.section-page-subtitle')).not.toBeNull();
  });

  test('editorial headers inherit the canonical website gutter', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toContain('--wrap:1440px;');
    expect(css).toContain('--wrap-gutter:clamp(28px,4vw,52px);');
    expect(css).toMatch(/\.guide-hero\.section-page-head,[\s\S]*padding:38px var\(--wrap-gutter\) 8px;/);
    expect(css).toMatch(/\.guide-hero \.section-page-subtitle,[\s\S]*white-space:normal;/);
  });

  test('the scoring explainer uses the full website content grid', () => {
    const html = fs.readFileSync(path.join(__dirname, 'how-scoring-works.html'), 'utf8');
    document.body.innerHTML = html;

    expect(document.querySelector('#how-scoring-works').classList.contains('scoring-article')).toBe(true);
    expect(html).toMatch(/\.scoring-article\s*\{[^}]*max-width:var\(--wrap\)/s);
    expect(html).toContain('.scoring-article [data-lang-block]>.guide-section{padding-top:18px;}');
    expect(html).toContain('images/editorial/scoring-dogs/bruna-labrador.png');
    expect(html).toContain('images/editorial/scoring-dogs/luna-border-collie.png');
    // Intro copy runs the full card width rather than stopping short of it.
    expect(html).toMatch(/\.scoring-article \.guide-section > p\s*\{[^}]*max-width:none/s);
  });
});
