const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'onboarding.html'), 'utf8');

describe('onboarding brand mark', () => {
  test('the hero photo rule is scoped to the photo, so the brand logo flows beside the wordmark', () => {
    // A bare `.ob-visual img` also matched the 26px logo inside .ob-brand and
    // pinned it to the panel origin, on top of the "OR" of ORMA.
    expect(html).not.toMatch(/\.ob-visual img\s*\{/);
    expect(html).toMatch(/\.ob-visual > #obImage\{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;/);
    expect(html).toContain('<img id="obImage"');
    expect(html).toMatch(/<span class="ob-brand"><img src="logo\.svg[^"]*" alt="">ORMA<\/span>/);
  });
});
