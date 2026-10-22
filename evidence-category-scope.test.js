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

  test('publication may write the six, and graduation the fuller set', () => {
    // Asserted against the values publication uses, not the spelling of a
    // literal. It read the hardcoded lists out of the source by regex, which
    // stopped applying when the badge was derived from what a specialist
    // actually asked about rather than asserted of every trail.
    const {SAFETY_CHECKS,GRADUATION_CHECKS,graduationFor}=
      require('./backoffice/workflows/build-publication-staging');
    expect([...SAFETY_CHECKS]).toEqual([...evidence.REVIEWABLE_CATEGORIES]);
    // Everything a review covers, plus the presentation and data checks.
    for(const category of evidence.REVIEWABLE_CATEGORIES){
      expect(GRADUATION_CHECKS).toContain(category);
    }
    expect(GRADUATION_CHECKS).toContain('route');
    expect(GRADUATION_CHECKS.length).toBeGreaterThan(evidence.REVIEWABLE_CATEGORIES.length);

    // The earned seal needs all of them; a trail nobody asked the safety
    // questions of shows as reviewed instead.
    expect(graduationFor([...SAFETY_CHECKS],true,true,['access','livestock']).status).toBe('verified');
    expect(graduationFor([],true,true).status).toBe('in-progress');
    expect(graduationFor([],true,true).completed).toContain('route');
    for(const category of SAFETY_CHECKS){
      expect(graduationFor([],true,true).completed).not.toContain(category);
    }
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
