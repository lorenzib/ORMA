/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'paw-protection.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'paw-protection-guide.js'), 'utf8');

describe('paw protection field guide redesign', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test('uses the design headline, purpose and breadcrumb', () => {
    expect(document.querySelector('h1').textContent.trim()).toBe('Rock changes the walk');
    expect(document.querySelector('.section-page-subtitle').textContent).toMatch(/hidden variable is not distance/i);
    const breadcrumb = document.querySelector('.paw-breadcrumbs');
    expect(breadcrumb.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(breadcrumb.querySelector('a').getAttribute('href')).toBe('../safety-guide.html');
    expect(breadcrumb.textContent).toMatch(/Paws & terrain/i);
  });

  test('shows the hero and three real terrain images', () => {
    expect(document.querySelector('.paw-hero-image').getAttribute('src')).toContain('paw-check-generated-small-v1.jpg');
    const terrainImages = Array.from(document.querySelectorAll('.paw-terrain-card img'));
    expect(terrainImages).toHaveLength(3);
    expect(terrainImages.map(image => image.getAttribute('src'))).toEqual([
      '../images/editorial/paw-terrain-limestone-real-v1.jpg',
      '../images/editorial/paw-terrain-scree-real-v1.jpg',
      '../images/editorial/paw-terrain-compact-real-v1.jpg',
    ]);
  });

  test('keeps the medical thresholds and collapsed references', () => {
    const firstAid = document.getElementById('call-vet').textContent;
    expect(firstAid).toMatch(/10 to 15 minutes of steady pressure/i);
    expect(firstAid).toMatch(/deep or gaping wound/i);
    expect(firstAid).toMatch(/deeply embedded object/i);
    expect(firstAid).toMatch(/cannot stand or walk/i);
    const sources = document.querySelector('.paw-sources');
    expect(sources.tagName).toBe('DETAILS');
    expect(sources.open).toBe(false);
    expect(sources.textContent).toMatch(/VCA Animal Hospitals/i);
    expect(sources.textContent).toMatch(/Merck Veterinary Manual/i);
  });

  test('surface checker starts at 100 and responds to selected conditions', () => {
    window.eval(script);
    expect(document.getElementById('pawScoreNumber').textContent).toBe('100');
    expect(document.getElementById('pawScoreStatus').textContent).toBe('Good to go');

    const hot = document.querySelector('input[name="heat"][value="70"]');
    hot.checked = true;
    hot.dispatchEvent(new Event('change', { bubbles:true }));
    expect(document.getElementById('pawScoreNumber').textContent).toBe('30');
    expect(document.getElementById('pawScore').dataset.tone).toBe('stop');
    expect(document.getElementById('pawScoreReasons').textContent).toMatch(/too hot for pads/i);
  });

  test('60-second check reports completion accessibly', () => {
    window.eval(script);
    const checks = document.querySelectorAll('.paw-check-item input');
    expect(checks).toHaveLength(6);
    checks[0].checked = true;
    checks[0].dispatchEvent(new Event('change', { bubbles:true }));
    expect(document.getElementById('pawCheckPercent').textContent).toBe('17%');
    expect(document.querySelector('.paw-progress-track').getAttribute('aria-valuenow')).toBe('1');
  });

  test('keeps the design sequence and end actions', () => {
    const ids = ['surface', 'heat', 'today-check', 'check', 'boots', 'prepare', 'turn-back', 'call-vet'];
    ids.forEach(id => expect(document.getElementById(id)).not.toBeNull());
    ids.slice(1).forEach((id, index) => {
      const previous = document.getElementById(ids[index]);
      const current = document.getElementById(id);
      expect(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(document.querySelector('.paw-keep-reading a').getAttribute('href')).toBe('water-for-dogs-on-trail.html');
    expect(document.querySelector('.paw-cta').getAttribute('href')).toBe('../browse-trails.html');
  });
});
