const fs = require('fs');

describe('logged-in discovery workspace layout', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');

  test('uses a dedicated greeting row above the discovery controls', () => {
    expect(html).toContain('class="li-toolbar-greet"');
    expect(html).toContain('id="liToolbarSummary"');
    expect(css).toMatch(/grid-template-areas:\s*"greet greet greet greet greet"\s*"search country region saved filters"/);
    expect(css).toMatch(/\.li-toolbar-greet\s*\{[^}]*display:flex;/s);
  });

  test('balances a bounded map with a proportional results pane', () => {
    expect(css).toMatch(/\.li-body\s*\{[^}]*grid-template-columns:minmax\(0,1\.65fr\) minmax\(380px,\.9fr\);[^}]*height:500px;/s);
    const desktopShellRule = css.match(/#returningCustomerHomepage\s*\{([^}]*)\}/);
    expect(desktopShellRule).not.toBeNull();
    expect(desktopShellRule[1]).not.toContain('height:100dvh');
  });
});
