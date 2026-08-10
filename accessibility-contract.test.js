const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('A11Y-01 core journey contract', () => {
  test('loads the shared accessibility runtime on core journey pages', () => {
    ['index.html', 'trail.html', 'account.html'].forEach(page => {
      expect(read(page)).toContain('accessibility-runtime.js');
    });
  });

  test('search exposes a combobox, listbox, and live result status', () => {
    const html = read('index.html');
    const controller = read('homepage-search.js');
    expect(html).toMatch(/id="hpSearch"[^>]+role="combobox"/);
    expect(html).toMatch(/id="hpSuggest"[^>]+role="listbox"/);
    expect(html).toMatch(/id="hpSearchStatus"[^>]+role="status"[^>]+aria-live="polite"/);
    expect(controller).toContain("e.key === 'ArrowDown' || e.key === 'ArrowUp'");
    expect(controller).toContain('aria-activedescendant');
  });

  test('readiness, offline, hike, and completion expose meaningful state', () => {
    expect(read('pre-hike-readiness.js')).toContain('DoloPawsA11y.openDialog');
    expect(read('pre-hike-readiness.js')).toContain("setAttribute('aria-busy'");
    expect(read('offline-packages.js')).toContain("panel.setAttribute('aria-busy'");
    expect(read('hike-mode.js')).toContain("statusAnnouncer.setAttribute('role', 'status')");
    expect(read('hike-mode.js')).toContain("urgentAnnouncer.setAttribute('role', 'alert')");
    expect(read('hike-mode.js')).toContain('if(!announcedOffRoute)');
    expect(read('hike-mode.js')).toContain('DoloPawsA11y.wireRadioGroup');
  });

  test('profile tabs and comparison removal remain operable and announced', () => {
    const account = read('account.js');
    const compare = read('compare-page.js');
    expect(account).toContain("['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End']");
    expect(compare).toContain("removed. ${selectedIds.length}");
    expect(read('compare.html')).toMatch(/id="compareStatus"[^>]+role="status"/);
  });

  test('global styles preserve focus and respect reduced motion', () => {
    const styles = read('styles.css');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.dp-skip-link');
  });

  test('primary text and action colour pairs meet WCAG AA contrast', () => {
    function channel(value){
      value /= 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }
    function luminance(hex){
      const value = parseInt(hex.slice(1), 16);
      return 0.2126 * channel(value >> 16) +
        0.7152 * channel((value >> 8) & 255) +
        0.0722 * channel(value & 255);
    }
    function ratio(a, b){
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0] + 0.05) / (values[1] + 0.05);
    }
    expect(ratio('#2E4034', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#59695D', '#F7F3E8')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#FFFFFF', '#3E7A91')).toBeGreaterThanOrEqual(4.5);
  });
});
