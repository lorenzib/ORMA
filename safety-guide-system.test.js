/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const guideFiles = [
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

const systemCss = fs.readFileSync(path.join(__dirname, 'guides', 'safety-guide-system.css'), 'utf8');

describe('shared Safety Library guide visual system', () => {
  test.each(guideFiles)('%s opts into the shared visual contract after its page styles', name => {
    const html = fs.readFileSync(path.join(__dirname, 'guides', name), 'utf8');
    document.documentElement.innerHTML = html;

    const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
    expect(document.body.classList.contains('safety-guide-article')).toBe(true);
    expect(stylesheets.at(-1).getAttribute('href')).toBe('safety-guide-system.css?v=20260901-2');
    expect(document.querySelectorAll('.safety-continue')).toHaveLength(1);
    expect(document.querySelectorAll('.safety-sources')).toHaveLength(1);
  });

  test('defines common canvas, hero, card, source and next-guide treatments', () => {
    expect(systemCss).toContain('--safety-guide-width:1680px');
    expect(systemCss).toContain('--safety-guide-gutter:clamp(24px,3vw,44px)');
    expect(systemCss).toContain('--guide-reading-width:none');
    expect(systemCss).toMatch(/\.safety-guide-article \.safety-photo-header\.section-page-head\{[^}]*justify-content:flex-end;[^}]*width:100%;[^}]*max-width:var\(--safety-guide-width\)/s);
    expect(systemCss).toContain('--safety-guide-card-radius:15px');
    expect(systemCss).toContain('.safety-guide-article .safety-photo-header.section-page-head');
    expect(systemCss).toContain('.safety-guide-article .safety-continue__next');
    expect(systemCss).toContain('.safety-guide-article .safety-continue__find');
    expect(systemCss).toContain('background:var(--safety-safe)');
    expect(systemCss).toMatch(/\.safety-guide-article \.safety-continue__find\{[^}]*background:var\(--safety-info\)/s);
    expect(systemCss).toMatch(/\.safety-guide-article \.safety-back-link\{[^}]*background:var\(--safety-info\)[^}]*color:#fff!important/s);
    expect(systemCss).toContain('.safety-guide-article .safety-sources');
    expect(systemCss).toMatch(/@media\(max-width:560px\)[\s\S]*grid-template-columns:max-content minmax\(0,1fr\) max-content/);
    expect(systemCss).toMatch(/\.safety-guide-article \.safety-continue__label\{flex-basis:auto;/);
  });

  test('maps information, safe action, caution and stop cards to semantic tokens', () => {
    expect(systemCss).toMatch(/\.water-card--info[^}]*background:var\(--safety-info-soft\)/s);
    expect(systemCss).toMatch(/\.water-card--safe[^}]*background:var\(--safety-safe-soft\)/s);
    expect(systemCss).toMatch(/\.water-card--caution[^}]*background:var\(--safety-caution-soft\)/s);
    expect(systemCss).toMatch(/\.water-card--stop[^}]*background:var\(--safety-stop-soft\)/s);
  });

  test('uses one pale red for alerts and green numbers on white action cards', () => {
    expect(systemCss).toMatch(/\.scan-alert[^}]*\.gp-warn[^}]*background:var\(--safety-stop-soft\)/s);
    expect(systemCss).toMatch(/\.alt-plan-panel[^}]*\.hs-action[^}]*background:var\(--card\)/s);
    expect(systemCss).toMatch(/\.scan-step-number[^}]*background:var\(--safety-safe\)/s);
    expect(systemCss).toMatch(/\.hs-action::before[^}]*background:var\(--safety-safe\)/s);
  });

  test('keeps heat cards white and uses blue only for a selected check', () => {
    expect(systemCss).toMatch(/\.hs-readiness[^}]*\.hs-observation[^}]*background:var\(--card\)/s);
    expect(systemCss).toMatch(/\.hs-check:has\(input:checked\)[^}]*background:var\(--safety-info-soft\)/s);
  });

  test('turns the water article into the same photo-header and scan-card structure', () => {
    const html = fs.readFileSync(path.join(__dirname, 'guides', 'water-for-dogs-on-trail.html'), 'utf8');
    document.documentElement.innerHTML = html;

    expect(document.querySelector('.safety-photo-header .safety-back-link')).not.toBeNull();
    expect(document.querySelector('.safety-photo-header__image').getAttribute('src')).toContain('dog-hydration-lake-unbranded-v1.jpg');
    expect(document.querySelector('main').classList.contains('water-guide-body')).toBe(true);
    expect(document.querySelectorAll('.water-card')).toHaveLength(4);
    expect(document.querySelectorAll('.water-card--info')).toHaveLength(1);
    expect(document.querySelectorAll('.water-card--caution')).toHaveLength(1);
    expect(document.querySelectorAll('.water-card--safe')).toHaveLength(1);
  });
});
