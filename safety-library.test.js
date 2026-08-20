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
    expect(html).not.toContain('ORMA mountain guidance');
    expect(html).not.toMatch(/\.sg-hero h1\{[^}]*font-size:/s);
  });

  test('does not show the dog-profile promotion or a divider above the disclaimer', () => {
    expect(document.body.classList.contains('safety-library-page')).toBe(true);
    expect(html).not.toContain('Find a trail that fits your dog');
    expect(html).not.toContain('Your next walk');
    expect(html).not.toMatch(/\.sg-disclaimer\{[^}]*border-top:/s);
  });

  test('keeps a compact five-rule overview and prominent emergency reference', () => {
    expect(document.querySelectorAll('.sg-rules li')).toHaveLength(5);
    expect(document.querySelector('.sg-emergency').textContent).toContain('European emergency');
    expect(document.querySelector('.sg-emergency').textContent).toContain('Veterinary ambulance');
    expect(document.querySelector('.sg-emergency a').getAttribute('href')).toBe('tel:112');
    expect(html).toMatch(/\.sg-emergency\{[^}]*background:#A93C31/s);
  });

  test('offers a five-question readiness questionnaire from the hero', () => {
    const opener = document.querySelector('#openReadinessQuiz');
    expect(opener.textContent).toMatch(/Are you ready\?/i);
    expect(opener.textContent).toMatch(/Test your preparation here/i);
    expect(document.querySelectorAll('#readinessQuiz .sg-question')).toHaveLength(5);
    expect(document.querySelector('#readinessQuizResult').getAttribute('aria-live')).toBe('polite');
    expect(html).toContain("dialog.showModal()");
    expect(html).toContain('5 of 5 ready');
  });
});
