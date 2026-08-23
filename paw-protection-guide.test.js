/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'paw-protection.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'paw-protection-guide.js'), 'utf8');

describe('paw protection question-led guide', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.breedTraits;
    delete window.DoloPawsAuth;
    delete window.DoloPawsAuthReady;
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

  test('keeps the universal guide to four compact essentials', () => {
    const basics = document.querySelectorAll('.paw2-basic');
    expect(basics).toHaveLength(4);
    expect(Array.from(basics).map(card => card.querySelector('h3').textContent.trim())).toEqual([
      'Moisturising', 'Hot surfaces', 'Snow & grit', 'Limestone & scree'
    ]);
    expect(document.querySelector('.paw2-basics').textContent).toMatch(/check before leaving, early on the trail/i);
    expect(document.querySelector('.paw2-meta strong').textContent.trim()).toBe('3 min guide');
  });

  test('explains the value of a dog profile and links guests to the wizard', () => {
    window.eval(script);
    expect(document.querySelector('[data-paw-personal-title]').textContent).toMatch(/your dog/i);
    expect(document.querySelector('[data-paw-personal-intro]').textContent).toMatch(/breed, build, age, coat and conditioning/i);
    expect(document.querySelector('[data-paw-personal-cta]').getAttribute('href')).toBe('/?wizard=1');
    expect(document.querySelectorAll('.paw2-personal-note')).toHaveLength(3);
  });

  test('uses the active saved profile for dog-specific paw guidance', () => {
    localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      uid:'user-1', activeDogId:'dog-1', dogs:[{
        id:'dog-1', name:'Nala', breed:'Great Dane', fitness:'high', weightBand:'40-55'
      }]
    }));
    window.breedTraits = jest.fn(() => ({ giant:true }));
    window.eval(script);
    expect(document.querySelector('[data-paw-personal-title]').textContent).toBe('For Nala’s paws');
    expect(document.querySelector('[data-paw-personal-list]').textContent).toMatch(/limestone descents/i);
    expect(document.querySelector('[data-paw-personal-list]').textContent).toMatch(/fitness does not equal tough pads/i);
    expect(document.querySelector('[data-paw-personal-cta]').textContent).toBe('Update Nala’s profile');
    expect(document.querySelector('[data-paw-personal-cta]').getAttribute('href')).toContain('../account.html');
  });

  test('can enrich cached advice with the complete authenticated profile', async () => {
    localStorage.setItem('dolopaws-profile-summary', JSON.stringify({ name:'Pip', breed:'Poodle', fitness:'moderate' }));
    window.DoloPawsAuthReady = true;
    window.DoloPawsAuth = {
      currentUser:{ uid:'user-1' },
      getDogProfile: jest.fn().mockResolvedValue({
        name:'Pip', breed:'Poodle', fitness:'moderate', coat:'Curly', sens:['paws']
      })
    };
    window.breedTraits = jest.fn(() => ({}));
    window.eval(script);
    await Promise.resolve();
    await Promise.resolve();
    const personalised = document.querySelector('[data-paw-personal-list]').textContent;
    expect(personalised).toMatch(/sensitive paws/i);
    expect(personalised).toMatch(/snow can hide between the toes/i);
  });

  test('keeps deeper guidance collapsed and opens linked detail when requested', () => {
    window.eval(script);
    const details = document.querySelectorAll('.paw2-detail');
    expect(details).toHaveLength(4);
    details.forEach(detail => expect(detail.open).toBe(false));
    document.querySelector('a[href="#first-aid"]').click();
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
    expect(html).toContain('src="../breeds-data.js');
    expect(html).toContain('src="../firebase-init.js');
    expect(html).toContain('@media(max-width:560px)');
  });
});
