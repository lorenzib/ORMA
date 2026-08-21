const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'safety-guide.html'), 'utf8');

describe('Safety library', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
  });

  test('uses the approved guide-first structure with photo-led links', () => {
    expect(document.querySelector('h1').textContent).toBe('Safety library');
    expect(document.querySelectorAll('.sg-guide-card')).toHaveLength(8);
    expect(document.querySelectorAll('.sg-guide-card img')).toHaveLength(8);
    expect([...document.querySelectorAll('.sg-guide-card')].every(card => card.getAttribute('href'))).toBe(true);
  });

  test('keeps the safety header aligned with the shared page-header scale', () => {
    expect(document.querySelector('.sg-hero').classList.contains('section-page-head')).toBe(true);
    expect(document.querySelector('.sg-hero-copy').textContent.length).toBeGreaterThan(300);
    expect(document.querySelector('.sg-hero-copy').textContent).toContain('recognise early warning signs');
    expect(html).toMatch(/\.sg-hero-copy\{[^}]*width:100%;[^}]*max-width:none/s);
    expect(html).not.toContain('ORMA mountain guidance');
    expect(html).not.toMatch(/\.sg-hero h1\{[^}]*font-size:/s);
  });

  test('does not show the dog-profile promotion or a divider above the disclaimer', () => {
    expect(document.body.classList.contains('safety-library-page')).toBe(true);
    expect(html).not.toContain('Find a trail that fits your dog');
    expect(html).not.toContain('Your next walk');
    expect(html).toMatch(/\.safety-library-page \.hp-prefooter\{[^}]*display:none!important/s);
    expect(html).not.toMatch(/\.sg-disclaimer\{[^}]*border-top:/s);
  });

  test('keeps a compact five-rule overview and prominent emergency reference', () => {
    const overview = document.querySelector('.sg-side');
    expect(overview.nextElementSibling.classList.contains('sg-layout')).toBe(true);
    expect(document.querySelectorAll('.sg-rules li')).toHaveLength(5);
    expect(document.querySelector('#rulesHeading').textContent).toMatch(/The five mountain rules/i);
    expect(document.body.textContent).not.toMatch(/Every mountain day/i);
    expect(document.querySelector('.sg-emergency').textContent).toContain('European emergency');
    expect(document.querySelector('.sg-emergency').textContent).toContain('Veterinary ambulance');
    expect(document.querySelector('.sg-emergency a').getAttribute('href')).toBe('tel:112');
    expect(html).toMatch(/\.sg-emergency\{[^}]*background:#A93C31/s);
    expect(html).toMatch(/\.sg-rules ol\{[^}]*grid-template-columns:repeat\(5/s);
    expect(html).toMatch(/\.sg-rules\{[^}]*background:#2F7089/s);
  });

  test('offers the five-question readiness questionnaire from a floating action', () => {
    const opener = document.querySelector('#openReadinessQuiz');
    expect(opener.classList.contains('sg-readiness-fab')).toBe(true);
    expect(opener.closest('.sg-hero')).toBeNull();
    expect(opener.textContent).toMatch(/Paws ready\?/i);
    expect(opener.querySelector('.sg-readiness-fab-icon').textContent).toBe('🐾');
    expect(html).toMatch(/\.sg-readiness-fab\{[^}]*background:#4B7653/s);
    expect(document.querySelectorAll('#readinessQuiz .sg-question')).toHaveLength(5);
    expect(document.querySelector('#readinessQuizResult').getAttribute('aria-live')).toBe('polite');
    expect(html).toContain("dialog.showModal()");
    expect(html).toContain('recommendationByQuestion');
    expect(html).toContain("form.addEventListener('change'");
  });

  test('uses the dedicated photographic safety-library imagery', () => {
    const guideImages = [...document.querySelectorAll('.sg-guide-card img')];
    const sources = guideImages.map(image => image.getAttribute('src'));
    expect(sources).toEqual(expect.arrayContaining([
      'images/editorial/safety-library/breed-group-considerations-v1.jpg',
      'images/editorial/safety-library/dogs-on-cable-cars-v1.jpg',
      'images/editorial/safety-library/heat-hydration-v1.jpg',
      'images/editorial/safety-library/paw-protection-v2.jpg',
      'images/editorial/safety-library/flowers-plants-dogs.jpg',
      'images/editorial/safety-library/livestock-guardian-dogs-v1.jpg',
      'images/editorial/safety-library/dogs-at-rifugi.jpg'
    ]));
    expect(guideImages.every(image => image.getAttribute('alt').trim().length > 0)).toBe(true);
    expect(document.body.textContent).toContain('Flowers, plants and dogs');
  });

  test('shows a tailored recommendation as soon as all five answers are complete', () => {
    const script = [...document.querySelectorAll('script')]
      .find(item => item.textContent.includes("const openButton = document.getElementById('openReadinessQuiz')"));
    const dialog = document.querySelector('#readinessQuiz');
    dialog.showModal = jest.fn();
    dialog.close = jest.fn();
    const scrollIntoView = jest.fn();
    document.querySelector('#readinessQuizResult').scrollIntoView = scrollIntoView;
    window.eval(script.textContent);

    ['yes','no','yes','yes','no'].forEach((answer, index) => {
      const input = document.querySelector(`input[name="q${index + 1}"][value="${answer}"]`);
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles:true }));
    });

    const result = document.querySelector('#readinessQuizResult');
    expect(result.hidden).toBe(false);
    expect(result.dataset.level).toBe('caution');
    expect(document.querySelector('#readinessResultTitle').textContent).toContain('Almost ready');
    expect(document.querySelector('#readinessResultSummary').textContent).toContain('3 of 5 checks');
    expect(document.querySelector('#readinessRecommendations').textContent).toContain('Carry enough water');
    expect(document.querySelector('#readinessRecommendations').textContent).toContain('Save the route');
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
