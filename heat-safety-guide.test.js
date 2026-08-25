const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'guides', 'heat-overheating.html'), 'utf8');

describe('Heat and hydration safety guide', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = html;
    const script = [...document.querySelectorAll('script')]
      .find(item => item.textContent.includes("const checks = [...document.querySelectorAll('[data-heat-check]')];"));
    window.eval(script.textContent);
  });

  test('presents a concise prevention and emergency structure', () => {
    expect(document.querySelector('h1').textContent).toBe('Heat and hydration safety');
    expect(document.querySelector('main').id).toBe('mainContent');
    expect(document.querySelectorAll('[data-heat-check]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-heat-level]')).toHaveLength(3);
    expect(document.body.textContent).toContain('Cool first, travel second');
    expect(document.body.textContent).toContain('Turn back earlier for higher-risk dogs');
    expect(document.body.textContent).not.toContain('Emergency boundary');
    expect(html).not.toContain('wet the belly and paw pads');
    expect(html).not.toContain('not ice-cold');
  });

  test('updates the pre-walk readiness result as checks are completed', () => {
    const checks = [...document.querySelectorAll('[data-heat-check]')];
    const status = document.getElementById('heatChecklistStatus');
    expect(status.textContent).toContain('0 of 4 checked');
    checks.forEach(check => {
      check.checked = true;
      check.dispatchEvent(new Event('change', { bubbles:true }));
    });
    expect(status.dataset.state).toBe('ready');
    expect(status.textContent).toContain('Start cautiously');
  });

  test('turns symptom selection into clear action feedback', () => {
    const emergency = document.querySelector('[data-heat-level="emergency"]');
    emergency.click();
    const response = document.getElementById('heatResponse');
    expect(emergency.getAttribute('aria-pressed')).toBe('true');
    expect(response.hidden).toBe(false);
    expect(response.dataset.level).toBe('emergency');
    expect(response.textContent).toContain('call a veterinarian now');
  });

  test('shows current veterinary and primary-research sources', () => {
    const sources = [...document.querySelectorAll('.hs-sources a')].map(link => link.href);
    expect(sources).toEqual(expect.arrayContaining([
      'https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/conditions/heatstroke-in-dogs',
      'https://pubmed.ncbi.nlm.nih.gov/38518416/'
    ]));
    expect(document.querySelector('.hs-sources').textContent).toContain('Last reviewed 23 August 2026');
  });
});
