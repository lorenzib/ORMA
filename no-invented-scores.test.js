const fs = require('fs');

// search.html shipped a prototype to production. Its match column was
// `Math.max(42, 94 - index * 3)` -- the first row scored 94%, the second 91%,
// the third 88%, whatever the trail and whatever the dog. It also said the
// results were "ranked for Nala", printed a raw `low-risk` enum and defaulted
// to claiming "Low-risk" when the field was missing, illustrated trails with
// whichever of four photographs the index landed on, and carried hardcoded
// area counts. Nothing linked to it, so nobody saw it, but it was published
// and in the iOS bundle -- reachable by anyone with the address.
//
// Two tests covered the page. Both asserted it existed and contained a line of
// copy; neither looked at what it rendered.
describe('a score is computed or it is not shown', () => {
  test('the prototype search page is gone, and stays gone', () => {
    expect(fs.existsSync('search.html')).toBe(false);
    expect(fs.existsSync('search-page.js')).toBe(false);

    const manifest = fs.readFileSync('pages-public-manifest.json', 'utf8');
    expect(manifest).not.toContain('search.html');
    expect(manifest).not.toContain('search-page.js');
    expect(fs.readFileSync('scripts/build-app.js', 'utf8')).not.toContain("'search.html'");
  });

  // The shape the page had, in case it is ever reached for again: a percentage
  // built from a row's position rather than from the engine.
  test('no shipped surface derives a match from a list position', () => {
    const shipped = fs.readdirSync('.').filter(file =>
      /\.(?:js|html)$/.test(file) && !file.endsWith('.test.js') && !file.endsWith('.bundle.js'));
    const invented = [];
    for(const file of shipped){
      const source = fs.readFileSync(file, 'utf8');
      // `94 - index * 3`, `100 - i*2`, and anything else that reads a score off
      // the loop counter it is being rendered in.
      if(/\b\d{2,3}\s*-\s*(?:index|i|rank|position|n)\s*\*/.test(source)) invented.push(file);
    }
    expect(invented).toEqual([]);
  });

  test('and nothing claims a safety rating the trail did not supply', () => {
    const shipped = fs.readdirSync('.').filter(file =>
      /\.(?:js|html)$/.test(file) && !file.endsWith('.test.js') && !file.endsWith('.bundle.js'));
    // Falling back to '' or 'unknown' says the rating is missing, which is
    // true. Falling back to a rating says the trail has one, which is not.
    const invents = /safetyLevel\s*\|\|\s*['"](?:low-risk|moderate|caution)['"]/;
    const asserted = shipped.filter(file => invents.test(fs.readFileSync(file, 'utf8')));
    expect(asserted).toEqual([]);
  });
});
