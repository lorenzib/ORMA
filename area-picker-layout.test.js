const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

describe('the destination picker fields', () => {
  test('the selects fill their columns instead of overflowing them', () => {
    // A <select> sizes to its widest option. min-width:0 permits shrinking, it
    // does not cause it, so without a width the three boxes kept their
    // intrinsic size, overflowed their grid cells and sat on top of each other.
    expect(css).toContain('.li-area-fields select{width:100%;box-sizing:border-box;}');
    expect(css).toContain('.li-area-fields label{min-width:0;}');
  });

  test('they wrap on the space they have, not on the width of the window', () => {
    // This panel is much narrower than the page it sits in, so a viewport
    // breakpoint kept three columns long after they stopped fitting and
    // squeezed "Choose country" down to "Choose cou".
    expect(css).toMatch(/\.li-area-fields\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(150px,1fr\)\);/);
    // And the breakpoint that used to do this job is gone rather than fighting it.
    const stacking = css.match(/@media \(max-width:700px\)\{[\s\S]*?\n\}/);
    expect(stacking).not.toBeNull();
    expect(stacking[0]).not.toContain('.li-area-fields{grid-template-columns:1fr;}');
  });
});
