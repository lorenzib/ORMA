const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { buildCanonicalCatalog } = require('./scripts/trail-adapter');

function loadTrust(){
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'trail-trust.js'), 'utf8'), context);
  return context.window.DoloPawsTrailTrust;
}

function loadScoring(){
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    'trust/evidence-v1.js',
    'scoring/recommendation-v1.js',
    'scoring/recommendation-adapters-v1.js',
    'scoring.js',
  ].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  });
  return trail => vm.runInContext(`scoreTrail(${JSON.stringify(trail)}, {terrain:'2', distance:'99', heatSensitive:false})`, context);
}

describe('trail data trust states', () => {
  const imported = { curated:false, safetyLevel:'low-risk', waterSources:[] };
  const reviewed = {
    path:[[46.5,11.6],[46.51,11.61]], safetyLevel:'low-risk', waterSources:[{ km:1, label:'Fountain' }],
    heatRisk:'low', shadeCoverage:60, exposure:false,
    // A trail only earns reviewed wording by carrying the review record.
    verified:{ categories:['water','heat','exposure','livestock','surfaceHazards','access'], sources:['Comune'], date:'2026-07-17' },
  };

  test('public rating labels stay simple while evidence remains internal', () => {
    const trust = loadTrust();
    expect(trust.riskLabel(imported, 'Low-risk terrain')).toBe('Low-risk terrain');
    expect(trust.provenanceLabel(imported)).toBe('Imported trail');
    expect(trust.provenanceLabel(reviewed)).toBe('Verified by ORMA');
  });

  test('missing observations become actionable guidance, not audit language', () => {
    const trust = loadTrust();
    expect(trust.waterAssessment(imported).title).toBe('Bring your own water');
    expect(trust.heatAssessment(imported).title).toBe('Plan for limited shade');
    expect(trust.exposureAssessment(imported)).toBeNull();
    expect(trust.livestockAssessment(imported, '')).toBeNull();
    expect(trust.assessmentNote(imported)).toMatch(/trail planning information/i);
    expect(trust.assessmentNote(imported)).not.toMatch(/unverified|checks|estimated/i);
    // Imported and unreviewed: the OSM-verified wording is replaced *and* the
    // caveat added, matching how the start point has always read.
    expect(trust.waterPointLabel(imported, 'Drinking water (OSM-verified location)'))
      .toBe('Water point mapped in OpenStreetMap, availability can change');
    expect(trust.startPointLabel(imported, 'Start here — Bus stop (OSM-verified access point)')).toMatch(/Mapped start suggestion.*check current access/i);
  });

  test('reviewed observations retain qualified positive states', () => {
    const trust = loadTrust();
    expect(trust.waterAssessment(reviewed).ok).toBe(true);
    expect(trust.heatAssessment(reviewed).ok).toBe(true);
    expect(trust.exposureAssessment(reviewed)).toBeNull();
    expect(trust.livestockAssessment(reviewed, '')).toBeNull();
  });

  test('partial source reviews do not expose progress metrics to customers', () => {
    const trust = loadTrust();
    const partial = {
      safetyLevel:'caution', terrainRank:2, terrainType:'Rocky path', exposure:true,
      reviewedAt:'2026-07-17', verified:{ categories:['exposure','surfaceHazards'], date:'2026-07-17' },
      waterSources:[{ km:2, label:'Stream' }], shadeCoverage:40, heatRisk:'moderate',
    };
    expect(trust.provenanceLabel(partial)).toBe('Imported trail');
    expect(trust.riskLabel(partial, 'Caution')).toBe('Caution');
    expect(trust.reviewProgress(partial).checked).toBe(2);
    expect(trust.waterAssessment(partial).title).toBe('Bring your own water');
    expect(trust.heatAssessment(partial).title).toBe('Plan for limited shade');
    expect(trust.exposureAssessment(partial).title).toBe('Exposed sections');
    expect(trust.surfaceAssessment(partial).title).toBe('Surface & footing');
    expect(trust.livestockAssessment(partial, '')).toBeNull();
  });

  test('unknown imported fields cap match confidence at 80 percent', () => {
    const score = loadScoring();
    expect(score({
      curated:false,
      safetyLevel:'low-risk',
      terrainRank:0,
      distance:3,
      surfaceHazards:[],
    })).toBe(80);
  });

  test('route audits show a date without pretending safety checks are complete', () => {
    const trust = loadTrust();
    const audited = { curated:false, reviewedAt:'2026-07-17', routeAudit:{ route:'checked' } };
    expect(trust.provenanceLabel(audited)).toBe('Imported trail');
    expect(trust.reviewProgress(audited)).toBeNull();
  });

  test('graduation progress remains available without appearing in public labels', () => {
    const trust = loadTrust();
    const graduating = {
      curated:false,
      reviewedAt:'2026-07-17',
      graduation:{
        status:'in-progress',
        required:['photo','route','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access'],
        completed:['photo','route','mapPoints','elevation','heat','access'],
        blockers:{water:'unknown',exposure:'unknown',livestock:'unknown',surfaceHazards:'unknown'},
      },
    };
    expect(trust.provenanceLabel(graduating)).toBe('Imported trail');
    expect(trust.graduationProgress(graduating).verified).toBe(false);
    expect(trust.riskLabel(graduating, 'Moderate terrain')).toBe('Moderate terrain');
  });

  test('completed graduation uses the public route-audited wording', () => {
    const trust = loadTrust();
    const audited = {
      curated:true,
      path:[[46.5,11.6],[46.51,11.61]],
      reviewedAt:'2026-07-26',
      graduation:{
        status:'verified',
        required:['photo','route'],
        completed:['photo','route'],
      },
    };
    expect(trust.provenanceLabel(audited)).toBe('Verified by ORMA');
  });

  test('partial source reviews also cap match confidence at 80 percent', () => {
    const score = loadScoring();
    expect(score({
      safetyLevel:'low-risk', terrainRank:0, distance:3, surfaceHazards:[], exposure:false,
      shadeCoverage:80, heatRisk:'low',
      verified:{ categories:['access','surfaceHazards'] },
    })).toBe(80);
  });

  test('tierOf resolves the three public tiers without a data migration', () => {
    const trust = loadTrust();
    const route = [[46.5, 11.6], [46.51, 11.61]];
    // Legacy data: derived from curated with no explicit tier.
    expect(trust.tierOf({ curated: false, path: route })).toBe('under-review');
    expect(trust.tierOf({ path: route })).toBe('route-audited');
    expect(trust.tierOf(undefined)).toBe('under-review');
    // An in-progress graduation is still under review.
    expect(trust.tierOf({ curated: false, path: route, graduation: {
      status: 'in-progress', required: ['photo', 'route'], completed: ['photo'],
    } })).toBe('under-review');
    // A fully graduated imported trail is route-audited.
    expect(trust.tierOf({ curated: false, path: route, graduation: {
      status: 'verified', required: ['photo', 'route'], completed: ['photo', 'route'],
    } })).toBe('route-audited');
    // Explicit fields win over derivation (when there is a route).
    expect(trust.tierOf({ curated: false, path: route, tier: 'route-audited' })).toBe('route-audited');
    expect(trust.tierOf({ curated: false, path: route, walked: true })).toBe('dolopaws-walked');
    expect(trust.tierOf({ tier: 'dolopaws-walked', path: route })).toBe('dolopaws-walked');
    expect(trust.provenanceLabel({ tier: 'dolopaws-walked', path: route })).toBe('Verified by ORMA');
    // A garbage tier value falls back to derivation, never trusted verbatim.
    expect(trust.tierOf({ curated: false, path: route, tier: 'nonsense' })).toBe('under-review');
  });

  test('a trail with no route cannot be route-audited or walked', () => {
    const trust = loadTrust();
    // Curated viewpoint/place listings with no path (e.g. Seceda Ridge) may
    // not claim the route was audited, there is no route.
    expect(trust.tierOf({ name: 'Seceda Ridge Trail' })).toBe('under-review');
    expect(trust.tierOf({ curated: true })).toBe('under-review');
    expect(trust.tierOf({ path: [[46.5, 11.6]] })).toBe('under-review'); // single point is not a route
    // Explicit tiers and flags cannot override the missing route.
    expect(trust.tierOf({ tier: 'route-audited' })).toBe('under-review');
    expect(trust.tierOf({ walked: true })).toBe('under-review');
    expect(trust.tierOf({ graduation: {
      status: 'verified', required: ['route'], completed: ['route'],
    } })).toBe('under-review');
  });

  test('catalog and detail templates include trust explanations', () => {
    const browse = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');
    const detail = fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8');
    const home = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

    expect(browse).toContain('browse.trustNote');
    expect(browse).toContain('trust.riskLabel(t, s[0])');
    expect(detail).toContain('trust.exposureAssessment(t)');
    expect(detail).toContain('trust.livestockAssessment(t, text)');
    // The logged-in homepage rows no longer show a heat badge; honesty about
    // data confidence now lives in the ≈ prefix on estimated (imported)
    // trails' match scores and the shared trailSafetyLabel() wording.
    expect(home).toContain("isEst ? '≈' : ''");
    expect(home).toContain('trailSafetyLabel(t)');
    expect(detail).not.toContain('No livestock noted in our field data');

    const importedPage = fs.readFileSync(path.join(__dirname, 'trails/planetenweg-sentiero-dei-pianeti.html'), 'utf8');
    const productionTrails = loadProductionTrails(__dirname);
    const reviewedSource = productionTrails.find(trail => trail.id === 'lago-braies');
    const reviewedTrail = buildCanonicalCatalog(productionTrails).records.find(trail => trail.id === 'lago-braies');
    expect(reviewedTrail).toBeDefined();
    const reviewedPage = fs.readFileSync(path.join(__dirname, 'trails', `${reviewedTrail.slug}.html`), 'utf8');
    expect(importedPage).toContain('Imported trail');
    expect(importedPage).not.toContain('Estimated:');
    expect(importedPage).not.toMatch(/Partly verified|Verification in progress|\d+\/\d+ checks/i);
    expect(importedPage).not.toContain('verified map data');
    expect(reviewedPage).toContain('Verified by ORMA');
    if (reviewedSource.graduation?.status === 'verified') {
      expect(reviewedPage).toContain('Verified by ORMA on');
    }
    expect(reviewedPage).not.toContain('Sources &amp; data');
    expect(reviewedPage).not.toContain('View source details');
    expect(reviewedPage).not.toContain('Trail evidence');
    (reviewedSource.sourceLinks || []).forEach(source => {
      expect(reviewedPage).not.toContain(source.url);
    });
  });

  // VERIFICATION.md: "Absent `verified` field = no category-by-category source
  // review is recorded." The code used to default the opposite way, so a
  // curated trail nobody had reviewed skipped every caveat and described its
  // water as reviewed. 23 trails were in that state, 12 of them with water.
  test('a trail with no review record verifies no category', () => {
    const trust = loadTrust();
    const unreviewed = { safetyLevel:'low-risk', waterSources:[{ km:1, label:'Fountain' }], heatRisk:'low', shadeCoverage:60 };
    ['water','heat','exposure','livestock','surfaceHazards','access']
      .forEach(category => expect(trust.categoryVerified(unreviewed, category)).toBe(false));
    expect(trust.waterAssessment(unreviewed).ok).toBe(false);
    expect(trust.waterAssessment(unreviewed).detail).toMatch(/carry enough/i);
    expect(trust.heatAssessment(unreviewed).ok).toBe(false);
  });

  test('a partly reviewed trail is verified only where it was reviewed', () => {
    const trust = loadTrust();
    const partial = { safetyLevel:'low-risk', waterSources:[], verified:{ categories:['access'], sources:['Comune'], date:'2026-09-06' } };
    expect(trust.categoryVerified(partial, 'access')).toBe(true);
    expect(trust.categoryVerified(partial, 'water')).toBe(false);
    expect(trust.categoryVerified(partial, 'heat')).toBe(false);
  });

  test('never presents an unreviewed water point as OSM-verified', () => {
    const trust = loadTrust();
    const label = trust.waterPointLabel({ curated:false }, 'Drinking water (OSM-verified location)');
    expect(label).not.toMatch(/OSM-verified/i);
    expect(label).toMatch(/availability can change/i);
  });
});
