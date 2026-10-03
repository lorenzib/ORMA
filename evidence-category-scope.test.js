const fs=require('fs');
const evidence=require('./trust/evidence-v1.js');

// I read the gap between these two lists as a bug and proposed "fixing" it.
// It is not one. VERIFICATION.md defines verified.categories as the six safety
// checks a source review covers, and puts route with photo, routeNumbers,
// mapPoints and elevation in graduation -- a different record answering a
// different question. Publication writes six and eleven because that is the
// contract, not because something was forgotten.
//
// These tests hold the standard and the code together, so the next person to
// notice the difference finds out what it means instead of closing it.
describe('what a source review can establish', () => {
  const doctrine=fs.readFileSync('VERIFICATION.md','utf8');

  test('the six reviewable categories are the ones the standard names', () => {
    expect(evidence.REVIEWABLE_CATEGORIES)
      .toEqual(['water','heat','exposure','livestock','surfaceHazards','access']);
    // Named in VERIFICATION.md as the canonical six.
    expect(doctrine).toMatch(/six canonical category names/);
    for(const category of evidence.REVIEWABLE_CATEGORIES){
      expect(doctrine).toContain(`\`${category}\``);
    }
  });

  test('route is a graduation check, not a safety category', () => {
    expect(evidence.REVIEWABLE_CATEGORIES).not.toContain('route');
    expect(doctrine).toMatch(/`verified\.categories` records the six safety checks/);
  });

  test('publication writes the six, and graduation the fuller set', () => {
    const staging=fs.readFileSync('backoffice/workflows/build-publication-staging.js','utf8');
    const verified=/verified:\{ categories:\[([^\]]+)\]/.exec(staging)[1];
    const graduation=/graduation:\{ status:'verified', required:\[([^\]]+)\]/.exec(staging)[1];
    const names=text=>text.split(',').map(part=>part.trim().replace(/'/g,''));
    expect(names(verified)).toEqual([...evidence.REVIEWABLE_CATEGORIES]);
    // Everything a review covers, plus the presentation and data checks.
    for(const category of evidence.REVIEWABLE_CATEGORIES){
      expect(names(graduation)).toContain(category);
    }
    expect(names(graduation)).toContain('route');
    expect(names(graduation).length).toBeGreaterThan(evidence.REVIEWABLE_CATEGORIES.length);
  });

  test('so a verified trail reports route evidence as unknown, by contract', () => {
    const trail={
      path:[[46.6,11.8],[46.61,11.81]],
      curated:true,
      verified:{ categories:[...evidence.REVIEWABLE_CATEGORIES], sources:['Dossier'], date:'2026-08-18' },
      graduation:{ status:'verified', required:['route'], completed:['route'] },
    };
    const assessment=evidence.assessTrail(trail, { asOfDate:'2026-08-19' });
    expect(assessment.categories.route.freshnessState).toBe('unknown');
    expect(assessment.categories.water.freshnessState).toBe('current');
  });

  // The freshness contract has dates in it that would matter if a reader ever
  // saw them. Today nobody does, and saying so stops the next person reading
  // an ageing date as a live warning.
  test('the per-category contract has no shipped caller yet', () => {
    const shipped=fs.readdirSync('.').filter(file =>
      /\.js$/.test(file) && !file.endsWith('.test.js') && !file.endsWith('.bundle.js'));
    const callers=shipped.filter(file => /assessTrail\s*\(/.test(fs.readFileSync(file,'utf8')));
    expect(callers).toEqual([]);
  });
});
