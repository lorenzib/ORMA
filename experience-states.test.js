const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('empty states and long-form navigation', () => {
  test('shared helper text and keyboard focus meet the accessibility baseline', () => {
    const styles = read('styles.css');
    expect(styles).toContain('--ink-soft:#59695D');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('outline:3px solid var(--accent) !important');
  });

  test('saved and journal empty states explain the next action', () => {
    document.body.innerHTML = read('saved.html');
    expect(document.querySelector('#savedEmpty.empty-state')).not.toBeNull();
    expect(document.querySelector('#savedEmpty .empty-state__action').textContent).toMatch(/Find a trail/i);

    document.body.innerHTML = read('journal.html');
    expect(document.querySelector('#jnEmpty.empty-state')).not.toBeNull();
    // 2026-07 design pass: "+ Log a walk" plus a live-tracking alternative.
    expect(document.getElementById('jnEmptyLogBtn').textContent).toMatch(/log a walk/i);
    expect(document.getElementById('jnEmptyLiveBtn').textContent).toMatch(/track live/i);
  });

  test('journal lifecycle and editing controls are translation-backed', () => {
    const html = read('journal.html');
    [
      'journal.title',
      'journal.empty.title',
      'journal.signedOut.title',
      'journal.modal.title',
      'journal.editTitle',
      'journal.storage',
    ].forEach(key => expect(html).toContain(`data-i18n="${key}"`));
    expect(html).toContain("window.t('journal.saved')");
    expect(html).toContain("window.t('journal.shareError')");
    expect(html).toContain("translate('journal.titleFor'");
  });

  test('browse and trail community content provide purposeful empty states', () => {
    const browse = read('browse-trails.html');
    const trail = read('trail.html');
    const reports = read('trail-reports.js');
    expect(browse).toContain('data-clear-empty');
    expect(browse).toContain('No trails match this combination');
    expect(reports).toContain('No trail photos yet');
    expect(reports).toContain('No reviews yet');
    expect(reports).toContain('No recent hazard reports');
    expect(trail).toContain('No trail photos yet');
    expect(trail).toContain('No reviews yet');
  });

  test('about page stays nav-free; the scoring page carries the split-out sections', () => {
    document.documentElement.innerHTML = read('about.html');
    window.eval(read('guide-navigation.js'));
    // A single-section letter is below the nav threshold.
    expect(document.querySelector('.guide-page-nav[data-generated]')).toBeNull();
    expect(document.body.innerHTML).toContain('About us');

    document.documentElement.innerHTML = read('how-scoring-works.html');
    window.eval(read('guide-navigation.js'));
    const en = document.querySelector('[data-lang-block="en"]');
    const h2s = [...en.querySelectorAll('h2')].map(h => h.textContent);
    expect(h2s).toHaveLength(1);
    expect(h2s[0]).toContain('The two scores');
    // The closing material resolves into one compact disclosure rather than
    // another page-sized section, and stays below the page-nav threshold.
    expect(en.querySelector('.sc-verification > summary').textContent).toContain('Verified or imported');
    expect(en.querySelectorAll('.sc-panel > .guide-section > h2')).toHaveLength(0);
    expect(en.querySelector('.sc-community-note')).not.toBeNull();
    expect(en.querySelectorAll('.sc-methodology-content p')).toHaveLength(1);
    expect(en.querySelector('.sc-methodology-content p').textContent).toContain("The score's boundaries");
    expect(en.querySelector('.sc-methodology-content p').textContent).toContain('What the numbers are based on');
    expect(document.querySelector('.guide-page-nav[data-generated]')).toBeNull();
  });

  test('compact decision guides stay focused without long-form navigation', () => {
    document.documentElement.innerHTML = read('guides/dogs-on-cable-cars.html');
    window.eval(read('guide-navigation.js'));
    expect(document.querySelectorAll('.guide-page-nav a')).toHaveLength(0);

    document.documentElement.innerHTML = read('guides/heat-overheating.html');
    window.eval(read('guide-navigation.js'));
    expect(document.querySelector('.guide-page-nav')).toBeNull();
  });
});
