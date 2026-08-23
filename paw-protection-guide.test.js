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

  test('leads with the selected question-led concept and Safety Library breadcrumb', () => {
    expect(document.querySelector('h1').textContent.trim()).toBe('What will your dog walk on?');
    expect(document.querySelector('.section-page-subtitle').textContent).toMatch(/ground conditions/i);
    const breadcrumb = document.querySelector('.paw2-breadcrumbs');
    expect(breadcrumb.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(breadcrumb.querySelector('a').getAttribute('href')).toBe('../safety-guide.html');
    expect(breadcrumb.textContent).toMatch(/Safety library/i);
  });

  test('uses a compact text-only hero consistent with the Safety Library', () => {
    expect(document.querySelector('.paw2-hero-image')).toBeNull();
    expect(document.querySelector('.section-page-subtitle').textContent).toMatch(/complete guide/i);
    expect(document.querySelector('.topnav-page').textContent.trim()).toBe('Safety library');
  });

  test('keeps the universal guide to four compact essentials', () => {
    const basics = document.querySelectorAll('.paw2-basic');
    expect(basics).toHaveLength(4);
    expect(Array.from(basics).map(card => card.querySelector('h3').textContent.trim())).toEqual([
      'Moisturising', 'Hot surfaces', 'Snow & grit', 'Limestone & scree'
    ]);
    expect(document.querySelector('.paw2-basics').textContent).toMatch(/check paws before leaving, early on the trail/i);
    expect(document.querySelector('.paw2-basics').textContent).not.toMatch(/These basics apply to every dog/i);
    expect(document.querySelector('.paw2-meta strong').textContent.trim()).toBe('3 min guide');
  });

  test('removes the profile and warning panels and leads into the complete guide', () => {
    expect(document.querySelector('.paw2-personal')).toBeNull();
    expect(document.querySelector('.paw2-stop-banner')).toBeNull();
    expect(document.querySelector('.paw2-library .paw2-kicker').textContent.trim()).toBe('Complete guide');
    expect(document.querySelector('.paw2-library-head p').textContent.trim()).toBe('Detailed advice, organised by task.');
  });

  test('keeps deeper guidance collapsed and opens linked detail when requested', () => {
    window.eval(script);
    const details = document.querySelectorAll('.paw2-detail');
    expect(details).toHaveLength(4);
    details.forEach(detail => expect(detail.open).toBe(false));
    window.history.replaceState({}, '', '#first-aid');
    window.dispatchEvent(new Event('hashchange'));
    expect(document.getElementById('first-aid').open).toBe(true);
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
    expect(html).not.toContain('src="../breeds-data.js');
    expect(html).not.toContain('src="../firebase-init.js');
    expect(html).toContain('@media(max-width:560px)');
  });
});
