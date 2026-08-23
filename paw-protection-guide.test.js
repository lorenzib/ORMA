/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'paw-protection.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'paw-protection-guide.js'), 'utf8');

describe('paw protection question-led guide', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
    window.history.replaceState({}, '', '/');
  });

  test('leads with the selected question-led concept and Safety Library breadcrumb', () => {
    expect(document.querySelector('h1').textContent.trim()).toBe('What will your dog walk on?');
    expect(document.querySelector('.section-page-subtitle').textContent).toMatch(/ground conditions/i);
    const breadcrumb = document.querySelector('.paw2-breadcrumbs');
    expect(breadcrumb.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(breadcrumb.querySelector('a').getAttribute('href')).toBe('../safety-guide.html');
    expect(breadcrumb.textContent).toMatch(/Safety library/i);
  });

  test('keeps the image compact and consistent with the Safety Library card', () => {
    const image = document.querySelector('.paw2-hero-image');
    expect(image.getAttribute('src')).toContain('safety-library/paw-protection-forest-v1.jpg');
    expect(html).toContain('.paw2-hero-image{display:block;width:176px;height:118px;');
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

  test('keeps deeper guidance collapsed and opens linked detail when requested', () => {
    window.eval(script);
    const details = document.querySelectorAll('.paw2-detail');
    expect(details).toHaveLength(4);
    details.forEach(detail => expect(detail.open).toBe(false));
    document.querySelector('a[href="#boots"]').click();
    expect(document.getElementById('boots').open).toBe(true);
  });

  test('keeps urgent medical thresholds, references and end actions', () => {
    const firstAid = document.getElementById('first-aid').textContent;
    expect(firstAid).toMatch(/10 to 15 minutes of steady pressure/i);
    expect(firstAid).toMatch(/deep or gaping wound/i);
    expect(firstAid).toMatch(/deeply embedded object/i);
    expect(firstAid).toMatch(/cannot stand or walk/i);
    const sources = document.querySelector('.paw2-sources');
    expect(sources.tagName).toBe('DETAILS');
    expect(sources.open).toBe(false);
    expect(sources.textContent).toMatch(/VCA Animal Hospitals/i);
    expect(document.querySelector('#call-vet a')).toBeNull();
    const recommendations = document.querySelectorAll('.paw2-next-card');
    expect(recommendations).toHaveLength(2);
    expect(Array.from(recommendations).map(link => link.getAttribute('href'))).toEqual([
      'heat-overheating.html',
      '../safety-guide.html'
    ]);
    expect(document.querySelector('.paw2-sources-copy small').textContent.trim()).toBe('Last reviewed 19 August 2026');
    expect(document.querySelector('.paw2-cta').getAttribute('href')).toBe('../browse-trails.html');
    expect(html).toContain('@media(max-width:560px)');
  });
});
