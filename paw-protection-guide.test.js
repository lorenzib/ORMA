/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'paw-protection.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'paw-protection-guide.js'), 'utf8');

describe('paw protection question-led guide', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.innerHTML = html;
    window.history.replaceState({}, '', '/');
  });

  test('leads with the selected question-led concept and Safety Library return CTA', () => {
    expect(document.querySelector('h1').textContent.trim()).toBe('Paw protection for mountain trails');
    expect(document.title).toBe('Paw protection for mountain trails | ORMA');
    expect(document.querySelector('.section-page-subtitle').textContent).toMatch(/main surface/i);
    const returnLink = document.querySelector('.safety-back-link');
    expect(returnLink.getAttribute('href')).toBe('../safety-guide.html');
    expect(returnLink.textContent).toMatch(/Go back to Safety Library/i);
    expect(document.querySelector('.paw2-breadcrumbs').textContent.trim()).toBe('Paw protection');
  });

  test('uses the Safety Library card image behind the compact page header', () => {
    const image = document.querySelector('.paw2-hero.safety-photo-header .safety-photo-header__image');
    expect(image.getAttribute('src')).toContain('safety-library/paw-protection-forest-v1.jpg');
    expect(image.getAttribute('alt')).toBe('');
    expect(html).not.toContain('class="paw2-hero-image"');
    expect(document.querySelector('.topnav-page').textContent.trim()).toBe('Safety library');
  });

  test('provides three accessible surface choices and matching advice panels', () => {
    const tabs = document.querySelectorAll('[data-paw-surface]');
    const panels = document.querySelectorAll('[data-paw-panel]');
    expect(tabs).toHaveLength(3);
    expect(panels).toHaveLength(3);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);
    expect(Array.from(tabs).map(tab => tab.textContent.trim())).toEqual(['Hot ground', 'Sharp rock', 'Snow & grit']);
    expect(document.querySelectorAll('.paw2-tab-icon')).toHaveLength(3);
    expect(Array.from(tabs).map(tab => tab.querySelector('.paw2-tab-icon').getAttribute('aria-hidden'))).toEqual(['true', 'true', 'true']);
    expect(html).toContain('.paw2-tab[data-paw-surface="hot"]{--surface-accent:var(--safety-caution);--icon-primary:#B96F14;--icon-secondary:#F3C45F;}');
    expect(html).toContain('.paw2-tab[data-paw-surface="rock"]{--surface-accent:var(--safety-stop);--icon-primary:#587653;--icon-secondary:#C77A52;--icon-tertiary:#4B91A7;}');
    expect(html).toContain('.paw2-tab[data-paw-surface="snow"]{--surface-accent:var(--safety-info);--icon-primary:#347A94;--icon-secondary:#76C3D5;}');
    expect(html).toContain('.paw2-tab-icon{display:grid;place-items:center;width:26px;height:26px;flex:none;}');
    expect(document.querySelectorAll('.paw2-icon-fill-secondary')).toHaveLength(3);
    expect(document.querySelectorAll('.paw2-icon-stroke-tertiary')).toHaveLength(1);
    expect(html).not.toMatch(/\.paw2-tab-icon\{[^}]*background:/);
    expect(html).not.toMatch(/\.paw2-tab-icon\{[^}]*border-radius:/);
    expect(html).toContain('.paw2-tab[aria-selected="true"]{background:var(--paw-card)');
    expect(html).not.toContain('.paw2-tab[aria-selected="true"]{background:var(--surface-soft)');
  });

  test('surface selection swaps the contextual guidance', () => {
    window.eval(script);
    const rockTab = document.querySelector('[data-paw-surface="rock"]');
    rockTab.click();
    expect(rockTab.getAttribute('aria-selected')).toBe('true');
    expect(rockTab.tabIndex).toBe(0);
    expect(document.querySelector('[data-paw-panel="hot"]').hidden).toBe(true);
    expect(document.querySelector('[data-paw-panel="rock"]').hidden).toBe(false);
    expect(document.querySelector('[data-paw-panel="rock"]').textContent).toMatch(/shorten the distance/i);
  });

  test('keyboard navigation moves through the surface tabs', () => {
    window.eval(script);
    const hotTab = document.querySelector('[data-paw-surface="hot"]');
    hotTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    const snowTab = document.querySelector('[data-paw-surface="snow"]');
    expect(snowTab.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-paw-panel="snow"]').hidden).toBe(false);
  });

  test('keeps deeper guidance open, concise and still collapsible', () => {
    window.eval(script);
    const details = document.querySelectorAll('.paw2-detail');
    expect(details).toHaveLength(4);
    expect(document.getElementById('pawLibraryTitle').textContent.trim()).toBe('Learn more');
    expect(html).toContain('.paw2-library{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));');
    expect(html).toContain('.paw2-library{grid-template-columns:1fr;}');
    expect(html).toContain('.paw2-detail[open]{grid-column:auto;}');
    expect(html).toContain('background:var(--paw-card)');
    expect(html).toContain('.paw2-detail-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0;}');
    expect(html).toContain('.paw2-detail-columns section{padding:12px 13px;border-radius:10px;background:var(--safety-safe-soft);}');
    expect(html).toContain('.paw2-detail-columns section:last-child{background:var(--safety-stop-soft);}');
    expect(html).not.toContain('help—and');
    expect(html).not.toContain('protect—and');
    details.forEach(detail => expect(detail.open).toBe(true));
    document.getElementById('boots').open = false;
    document.querySelector('a[href="#boots"]').click();
    expect(document.getElementById('boots').open).toBe(true);
  });

  test('keeps urgent medical thresholds, references and end actions', () => {
    const firstAid = document.getElementById('first-aid').textContent;
    expect(firstAid).toMatch(/10 to 15 minutes of steady pressure/i);
    expect(firstAid).toMatch(/deep or gaping wound/i);
    expect(firstAid).toMatch(/deeply embedded object/i);
    expect(firstAid).toMatch(/cannot stand or walk/i);
    const sources = document.querySelector('.safety-sources');
    expect(sources.tagName).toBe('DETAILS');
    expect(sources.open).toBe(false);
    expect(sources.textContent).toMatch(/VCA Animal Hospitals/i);
    expect(document.querySelector('#call-vet a')).toBeNull();
    expect(document.querySelector('#call-vet .paw2-first-aid-icon')).toBeNull();
    const firstAidAlert = document.getElementById('call-vet');
    expect(firstAidAlert.previousElementSibling.className).toBe('paw2-surface-heading');
    expect(firstAidAlert.nextElementSibling.className).toBe('paw2-surface-grid');
    expect(document.querySelector('.paw2-side-stack').children).toHaveLength(1);
    expect(document.querySelector('.paw2-essentials').textContent).toMatch(/Always do these three/i);
    expect(html).toContain('background:var(--paw-card);color:var(--paw-ink)');
    expect(html).toContain('.paw2-advice{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:17px;}');
    expect(html).not.toMatch(/\.paw2-advice\{[^}]*border-top:/);
    expect(html).not.toMatch(/\.paw2-advice div\+div\{[^}]*border-left:/);
    expect(html).toContain('.paw2-stop{margin:10px 0 0;padding:11px 14px;border-radius:10px;background:var(--safety-stop-soft);color:var(--paw-soft)');
    expect(html).toContain('.paw2-stop strong{display:block;margin-bottom:4px;color:var(--safety-stop)');
    expect(document.querySelectorAll('.paw2-stop strong')).toHaveLength(3);
    expect(Array.from(document.querySelectorAll('.paw2-stop strong')).every(label => label.textContent.trim() === 'Stop if')).toBe(true);
    const recommendations = document.querySelectorAll('.safety-continue a');
    expect(recommendations).toHaveLength(2);
    expect(Array.from(recommendations).map(link => link.getAttribute('href'))).toEqual([
      'heat-overheating.html',
      '../?wizard=1'
    ]);
    expect(document.querySelector('.safety-sources__heading span').textContent.trim()).toBe('Last reviewed 19 August 2026');
    expect(document.querySelector('.safety-continue__cta')).toBeNull();
    expect(html).not.toContain('src="../breeds-data.js');
    expect(html).not.toContain('src="../firebase-init.js');
    expect(html).toContain('@media(max-width:560px)');
  });
});
