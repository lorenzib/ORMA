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
    // A saved walk is confirmed in the sheet that opens on it.
    expect(html).toContain('data-i18n="journal.after.saved"');
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
    expect(trail).toContain('No recent hazard reports');
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
    // The closing material is one line per badge rather than another
    // page-sized section, and stays below the page-nav threshold.
    expect(en.querySelector('.sc-trust-title').textContent).toContain('How well we know the trail');
    // One line per badge the site shows, and Verified is described as checked
    // against official sources, never as walked or measured by ORMA.
    for(const block of document.querySelectorAll('[data-lang-block]')){
      expect(block.querySelectorAll('.sc-trust-row')).toHaveLength(3);
      expect(block.querySelector('.badge-reviewed')).not.toBeNull();
    }
    const verified = en.querySelector('.badge-verified').closest('.sc-trust-row').textContent;
    expect(verified).toContain('official sources');
    // A board walk keeps the seal only with directions you can follow
    // (OPERATING_STANDARD.md, "A board walk is Verified only if it can be followed").
    expect(verified).toContain('directions');
    expect(verified).not.toMatch(/Measured and reviewed by us|our own notes/);
    expect(en.querySelectorAll('.sc-panel > .guide-section > h2')).toHaveLength(0);
    expect(en.querySelectorAll('.sc-methodology-content')).toHaveLength(0);
    expect(en.querySelectorAll(':scope > .sc-limits')).toHaveLength(1);
    expect(en.querySelector('.sc-limits').textContent).toContain('a guide, not a guarantee');
    // Today's heat forecast does reach the score, so the page must not say otherwise.
    expect(en.textContent).not.toContain("cannot see today's weather");
    expect(en.querySelector('.sc-limits strong')).toBeNull();
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
