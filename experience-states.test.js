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

  test('about page receives generated section navigation', () => {
    document.documentElement.innerHTML = read('about.html');
    window.eval(read('guide-navigation.js'));
    const nav = document.querySelector('.guide-page-nav[data-generated]');
    expect(nav).not.toBeNull();
    expect(nav.querySelectorAll('a')).toHaveLength(4);
    expect(document.querySelectorAll('[data-lang-block="en"] .guide-anchor')).toHaveLength(4);
  });

  test('long guide articles receive navigation while short ones stay focused', () => {
    document.documentElement.innerHTML = read('guides/dogs-on-cable-cars.html');
    window.eval(read('guide-navigation.js'));
    expect(document.querySelectorAll('.guide-page-nav a')).toHaveLength(5);

    document.documentElement.innerHTML = read('guides/heat-overheating.html');
    window.eval(read('guide-navigation.js'));
    expect(document.querySelector('.guide-page-nav')).toBeNull();
  });
});
