const fs = require('fs');
const path = require('path');
const { evaluateBundled } = require('./test-support/trail-runtime.js');

function source(file){
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

describe('UX-04 canonical recommendation journey', () => {
  const html = source('trail.html');
  const controller = source('trail-recommendation.js');
  const generator = source('scripts/generate-trail-pages.js');

  test('trail detail exposes one canonical decision block', () => {
    expect(html).toContain('id="recommendationDecision"');
    const { expectBundled, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');
    expectTrailBundleLoaded();
    expectBundled('recommendation-decision.js');
    expectBundled('trail-recommendation.js');
    // The card scores against today when the forecast has landed, and against
    // the route alone before it has. Nothing else supplies currentConditions,
    // so this is the only place the "today" in the pitch actually enters.
    expect(controller).toContain('recommendTrail(scored, subjectFor(profile), conditions)');
    // Absent weather and no warnings stay undefined rather than being guessed
    // at; warnings ride alongside the weather when either exists.
    expect(controller).toContain('window.DoloPawsCurrentConditions || warnings.length');
    expect(controller).toContain("{ status:'not-provided', ...(window.DoloPawsCurrentConditions || {}), warnings }");
    expect(controller).toContain("window.addEventListener('dolopaws-conditions-ready', renderCurrent)");
    expect(controller).toContain("window.addEventListener('orma-area-warnings-ready', renderCurrent)");
    expect(controller).toContain('window.OrmaAreaWarnings');
    expect(controller).toContain('root.dataset.scoringVersion = view.scoringVersion');
  });

  test('the breakdown shows short reasons and fit chips, with no "not checked" list', () => {
    expect(controller).toContain('view.shortReasons');
    expect(controller).toContain('view.fitChips');
    expect(html).toContain('.recommendation-fits li{');
    expect(controller).not.toContain('recommendation-unchecked');
    // The fold line and its bare "fine" chip are gone.
    expect(controller).not.toContain('recommendation-fine');
  });

  test('conclusion, reasons, cautions, and unknowns come from one presentation', () => {
    expect(controller).toContain('view.conclusion');
    expect(controller).toContain('view.reasons');
    expect(controller).toContain('view.cautions');
    expect(controller).toContain('view.dogGapFields');
    // Unknowns are LISTED only in the evidence/conditions card; the card
    // face carries a data-completeness chip and an actionable dog-gap CTA,
    // while source detail lives in the evidence disclosure.
    expect(controller).not.toContain('<details class="recommendation-unknowns"');
    expect(controller).toContain('view.confidenceLabel');
    expect(controller).toContain('recommendation-gaps');
    expect(controller).not.toContain('recommendationEvidenceMeta');
    expect(controller).toContain('${esc(view.heroSummary)}');
    expect(controller).not.toContain('trail.safetyLevel');
  });

  test('P0-3 keeps a guest on the trail they were reading', () => {
    const wizard = source('dog-wizard.js');

    // The CTA opens the wizard in place. Navigating to onboarding.html is the
    // thing this story exists to remove.
    expect(controller).toContain('data-add-dog');
    expect(controller).toContain("window.DoloPawsWizard.open(null, { returnToPage:true })");
    expect(wizard).toContain('returnToPage = !!(options && options.returnToPage)');

    // A guest's dog is kept for the session as soon as it is complete, so the
    // next trail scores for their dog without an account.
    expect(wizard).toContain("localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(profile))");
    expect(wizard).toContain("new CustomEvent('dolopaws-dog-profile-saved'");
    expect(controller).toContain("window.localStorage.getItem('dolopaws-pending-dog-profile')");
    expect(controller).toContain("window.addEventListener('dolopaws-dog-profile-saved', renderCurrent)");

    // The score change is visible, once, and respects reduced motion.
    expect(controller).toContain("classList.add('is-rescored')");
    // The move is shown by the card itself, not by a banner restating it.
    expect(controller).not.toContain('recommendation-firstrun');
    expect(html).not.toContain('.recommendation-firstrun');
    expect(html).toContain('@keyframes recommendation-rescore');
    expect(html).toContain('prefers-reduced-motion:reduce');
  });

  test('the three distinct actions remain reachable without a data-detail link on the card', () => {
    expect(html).toContain('id="trailReviewNote"');
    expect(html).not.toContain('id="trailEvidence"');
    expect(controller).not.toContain('About this trail data');
    expect(controller).not.toContain('recommendation-evidence-link');
    expect(controller).toContain('data-recommendation-save');
    expect(controller).toContain('data-recommendation-compare');
    expect(controller).toContain('data-recommendation-download');
  });

  test('generated pages defer personalized conclusions to the interactive contract', () => {
    expect(generator).toContain('data-scoring-version="${recommendationContract.VERSION}"');
    expect(generator).toContain(
      'Open the interactive trail guide to see their personalised match and any cautions.'
    );
    expect(generator).not.toContain('recommendationContract.calculateRecommendation');
  });

  test('guest runtime renders an explicitly unpersonalized canonical decision', () => {
    document.body.innerHTML =
      '<p id="heroVerdict"></p>' +
      '<button id="detailSaveBtn">Save</button>' +
      '<section id="offlinePackagePanel" hidden></section>' +
      '<button id="offlineDownloadBtn">Download</button>' +
      '<section id="td2SafetyCard"><div id="dogSafetyRows"><div data-guide-id="livestock"></div></div><div id="trailGuideLinks" hidden></div></section>' +
      '<details id="trailEvidence"></details>' +
      '<section id="recommendationDecision" hidden></section>';
    window.history.replaceState(null, '', '/trail.html?id=demo-loop');
    window.trails = [{ id:'demo-loop', name:'Demo Loop' }];
    window.recommendTrail = jest.fn(() => ({
      score:64,
      category:'possible-with-cautions',
      confidence:'low',
      scoringVersion:'1.6.0',
      evidenceTier:'mapped',
      positiveReasons:[{ message:'Distance is within range.' }],
      cautions:[{ code:'trail.shade.low', message:'Shade is limited.' }],
      hardStops:[],
      unknowns:[{ code:'trail.dog-access.unknown', message:'Access is not reviewed.' }],
    }));
    window.DoloPawsAuthReady = true;
    window.DoloPawsOffline = null;
    window.eval(source('comparison-state.js'));
    // The vocabulary and the view that reads it, in the order the trail
    // bundle runs them. Without the first the confidence chip has no words,
    // and a test cannot tell that from a chip nobody asked for.
    evaluateBundled(text => window.eval(text), [
      'match-verdict.js', 'recommendation-decision.js',
    ]);
    window.eval(source('recommendation-guides.js'));
    window.eval(controller);

    const block = document.getElementById('recommendationDecision');
    expect(block.hidden).toBe(false);
    expect(block.textContent).toContain('General view: no dog added');
    expect(block.textContent).toContain('Good with care');
    expect(block.textContent).toContain('Distance is within range.');
    expect(block.textContent).toContain('Shade is limited.');
    const guideLinks = document.getElementById('trailGuideLinks');
    expect(guideLinks.hidden).toBe(true);
    expect(guideLinks.parentElement.id).toBe('td2SafetyCard');
    expect(guideLinks.textContent).toBe('');
    const contextualGuide = document.querySelector('[data-guide-id="livestock"] .safety-row-guide');
    expect(contextualGuide).not.toBeNull();
    expect(contextualGuide.textContent).toContain('Livestock and guardian dogs');
    expect(contextualGuide.getAttribute('href')).toBe('guides/livestock-guard-dogs.html');
    // Calm data-completeness chip instead of "low confidence" jargon.
    expect(block.textContent).toContain('Based on partial data');
    expect(block.textContent).not.toContain('low confidence');
    expect(block.textContent).not.toContain('canonical scoring');
    // Unpersonalized view: the fixable gap is the missing dog itself.
    expect(block.textContent).toContain('Add your dog to sharpen this score');
    // Internal unknown-count and scoring language stay out of customer copy.
    expect(document.body.textContent).not.toContain('trail fact not yet verified');
    expect(document.body.textContent).not.toContain('Canonical scoring');
    // Unknown dog rules are not said at all, and there is no separate
    // "not checked yet" list any more.
    expect(block.textContent).not.toContain('dog rules');
    expect(block.textContent).not.toContain('Access is not reviewed.');
    expect(block.querySelector('.recommendation-unchecked')).toBeNull();
    const heroVerdict = document.getElementById('heroVerdict');
    expect(heroVerdict.hidden).toBe(false);
    expect(heroVerdict.querySelector('.td2-verdict-text').textContent)
      .toBe('Good with care for a typical dog. Add your dog for a personal match.');
    expect(heroVerdict.querySelector('a.td2-verdict-why').getAttribute('href')).toBe('#recommendationDecision');
    expect(window.recommendTrail).toHaveBeenCalledTimes(1);
  });
});

describe('the trail page breakdown: short reasons, fit chips, points one tap away', () => {
  const controller = fs.readFileSync(path.join(__dirname, 'trail-recommendation.js'), 'utf8');
  const slice = (start, end) => controller.slice(controller.indexOf(start), controller.indexOf(end));
  // eslint-disable-next-line no-new-func
  const breakdown = new Function(
    `${slice('  function esc(', '  function tr(')}\n${slice('  function breakdown(', '  function sections(')}\nreturn breakdown;`
  )();
  const tr = (key, fallback, vars) => Object.keys(vars || {})
    .reduce((out, name) => out.split(`{${name}}`).join(vars[name]), fallback);
  const view = {
    score:82, breakdownFor:'Teo', breakdown:[{}, {}, {}],
    shortReasons:[
      { text:'Steeper than Teo likes, up to 26% in places.', tone:'cost' },
      { text:'We haven’t found this area’s dog rules yet. Ask the local tourist office before you go.', tone:'note' },
    ],
    fitChips:['6 km', '330 m climb', 'No drops'],
    factorRows:[
      { topic:'Steepness', tone:'cost', points:'−10' },
      { topic:'Distance', tone:'ok', points:'0' },
      { topic:'Climb', tone:'ok', points:'0' },
      { topic:'Drops', tone:'ok', points:'0' },
    ],
  };

  test('the reasons are one line each, with no points beside them', () => {
    const html = breakdown(view, tr);
    const reasons = html.slice(html.indexOf('<ul class="recommendation-reasons">'), html.indexOf('</ul>'));
    for(const reason of view.shortReasons) expect(reasons).toContain(reason.text.replace('’', '’'));
    expect(reasons).toContain('class="is-note"');
    expect(reasons).not.toMatch(/−\d/);
  });

  test('what fits is one row of chips under "Fits Teo"', () => {
    const html = breakdown(view, tr);
    const fits = html.slice(html.indexOf('<div class="recommendation-fits">'));
    expect(fits).toMatch(/^<div class="recommendation-fits"><strong>Fits Teo<\/strong><ul><li>6 km<\/li><li>330 m climb<\/li><li>No drops<\/li><\/ul>/);
  });

  test('a closed "How the score adds up" list still holds every factor, without a column of zeros', () => {
    const html = breakdown(view, tr);
    const points = html.slice(html.indexOf('<details class="recommendation-points">'));
    expect(points).toMatch(/^<details class="recommendation-points"><summary>How the score adds up<\/summary>/);
    // One row for what costs points, one line naming everything else.
    expect(points.match(/<li[ >]/g)).toHaveLength(2);
    expect(points).toContain('−10');
    expect(points).toContain('Everything else<small>Distance · Climb · Drops</small>');
    expect(points.match(/>0</g)).toHaveLength(1);
    expect(points).toContain('How ORMA scores a walk');
  });
});
