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
    expect(document.querySelectorAll('[data-heat-level]')).toHaveLength(0);
    expect(document.querySelectorAll('.hs-observation')).toHaveLength(3);
    expect(document.body.textContent).toContain('Cool first, travel second');
    expect(document.querySelector('.hs-risk')).toBeNull();
    expect(document.body.textContent).not.toContain('Emergency boundary');
    expect(html).not.toContain('wet the belly and paw pads');
    expect(html).not.toContain('not ice-cold');
  });

  test('puts the higher-risk dogs and the wet-towel warning in the quick list', () => {
    const quick = document.querySelector('.guide-quick');
    expect(quick.textContent).toContain('turn back earlier');
    expect(quick.textContent).toContain('Never cover an overheating dog with a wet towel');
  });

  test('makes the next-guide action prominent', () => {
    const nextGuide = document.querySelector('.safety-continue__next');
    expect(nextGuide.classList.contains('hs-next-cta')).toBe(false);
    expect(html).toContain('safety-guide-system.css?v=20261106-1');
    expect(nextGuide.getAttribute('href')).toBe('water-for-dogs-on-trail.html');
  });

  test('aligns cooling-step numbers with their action titles', () => {
    expect(html).toMatch(/\.hs-action\{[^}]*display:grid;[^}]*grid-template-columns:25px minmax\(0,1fr\)/s);
    expect(html).toMatch(/\.hs-action::before\{[^}]*grid-row:1;/s);
    expect(html).toMatch(/\.hs-action strong\{[^}]*grid-row:1;[^}]*min-height:25px;/s);
    expect(html).toMatch(/\.hs-action span\{[^}]*grid-row:2;/s);
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

  test('shows every symptom response without requiring a selection', () => {
    const observations = [...document.querySelectorAll('.hs-observation')];
    expect(observations.map(card => card.querySelector('h3').textContent)).toEqual([
      'Breathing and moving normally',
      'Hard panting, slowing or seeking shade',
      'Weakness, abnormal gums, confusion or collapse',
    ]);
    expect(document.getElementById('heatResponse')).toBeNull();
    expect(observations[1].textContent).toContain('Stop exercise now');
    expect(observations[2].textContent).toContain('call a veterinarian now');
  });

  test('names the consulted veterinary and primary-research sources', () => {
    const sources = document.querySelector('.safety-sources');
    expect(sources.textContent).toContain('PDSA guidance on heatstroke in dogs');
    expect(sources.textContent).toContain('Carter et al. (2024)');
    expect(sources.textContent).toContain('Last reviewed 23 August 2026');
  });
});
