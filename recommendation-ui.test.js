const fs = require('fs');
const path = require('path');

function source(file){
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

describe('UX-04 canonical recommendation journey', () => {
  const html = source('trail.html');
  const controller = source('trail-recommendation.js');
  const generator = source('scripts/generate-trail-pages.js');

  test('trail detail exposes one canonical decision block', () => {
    expect(html).toContain('id="recommendationDecision"');
    expect(html).toContain('recommendation-decision.js');
    expect(html).toContain('trail-recommendation.js');
    expect(controller).toContain('const recommendation = recommendTrail(trail, subjectFor(profile))');
    expect(controller).toContain('root.dataset.scoringVersion = view.scoringVersion');
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
    expect(controller).toContain('hero.textContent = view.heroSummary');
    expect(controller).not.toContain('trail.safetyLevel');
  });

  test('the three distinct actions remain reachable without a data-detail link on the card', () => {
    expect(html).toContain('id="trailEvidence"');
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
      scoringVersion:'1.1.0',
      evidenceTier:'mapped',
      positiveReasons:[{ message:'Distance is within range.' }],
      cautions:[{ code:'trail.shade.low', message:'Shade is limited.' }],
      hardStops:[],
      unknowns:[{ message:'Access is not reviewed.' }],
    }));
    window.DoloPawsAuthReady = true;
    window.DoloPawsOffline = null;
    window.eval(source('comparison-state.js'));
    window.eval(source('recommendation-decision.js'));
    window.eval(source('recommendation-guides.js'));
    window.eval(controller);

    const block = document.getElementById('recommendationDecision');
    expect(block.hidden).toBe(false);
    expect(block.textContent).toContain('Unpersonalized planning view');
    expect(block.textContent).toContain('Possible with cautions');
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
    expect(block.textContent).not.toContain('Access is not reviewed.');
    expect(document.getElementById('heroVerdict').textContent)
      .toBe('Possible with cautions in an unpersonalized planning view.');
    expect(window.recommendTrail).toHaveBeenCalledTimes(1);
  });
});
