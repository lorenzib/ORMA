const path = require('path');

// The image desk appended an <img> for every candidate and only set its src when
// the candidate carried an assetUrl or an uploadRef. The AI path deliberately
// returns neither -- "Do not claim an image exists; assetUrl must be null and
// status must be needs-generation" -- so those cards rendered an empty picture
// frame with no explanation, and the desk looked broken rather than busy.
//
// This drives the real page against a stubbed backoffice API rather than
// asserting on source strings, which is what let the blank frame survive.

const GAP = { slug:'alpe-siusi', trailId:'alpe-siusi', title:'Alpe di Siusi Meadow Loop',
  region:'dolomites', coverageState:'missing', priority:'high', status:'awaiting-review' };

function candidate(overrides){
  return { title:'Meadow view', sourcePageUrl:null, assetUrl:null, creator:'ORMA',
    license:'Rights pending', licenseUrl:null, rightsEvidence:'Pending review',
    altText:'Alpe di Siusi', status:'needs-generation', generationPrompt:null, ...overrides };
}

async function renderWith(candidates){
  jest.resetModules();
  document.body.innerHTML = `<p id="imageCoverageState"></p><div id="imageGapGrid"></div>
    <input id="trailImageSearch"><select id="trailImageRegion"></select>`;
  const artifacts = {
    'image-coverage': { ok:true, data:{ summary:{ missing:1, dolomitesMissing:1 }, gaps:[GAP] } },
    'image-coverage-results': { ok:true, data:{ items:[
      { slug:'alpe-siusi', generatedAt:'2026-09-05T00:00:00.000Z', summary:'Agent result', candidates },
    ] } },
    'trail-image-coverage-status': { ok:true, data:{} },
    'trail-image-publication-requests': { ok:true, data:{ requests:[] } },
  };
  window.ORMABackoffice = {
    getArtifact: async id => artifacts[id] || { ok:false, error:'artifact-not-found' },
    getImageReviews: async () => ({ ok:true, reviews:[] }),
    getRevisionJobs: async () => ({ ok:true, jobs:[] }),
    getTrailImagePreview: async () => ({ ok:true, url:'blob:preview' }),
  };
  require(path.join(__dirname, 'image-coverage-hosted.js'));
  await new Promise(resolve => setTimeout(resolve, 0));
}

afterEach(() => { delete window.ORMABackoffice; });

describe('image candidates without an asset explain themselves', () => {
  test('a needs-generation candidate renders an explanation, not an empty frame', async () => {
    await renderWith([candidate()]);
    const card = document.querySelector('.bo-picture-candidate');
    expect(card).not.toBeNull();
    // The bug: an <img> with no src.
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toContain('AI brief, not an asset');
  });

  test('a blocked candidate says the rights are blocked', async () => {
    await renderWith([candidate({ status:'blocked' })]);
    const card = document.querySelector('.bo-picture-candidate');
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toContain('Rights are blocked');
  });

  test('a candidate with an assetUrl still renders a picture', async () => {
    await renderWith([candidate({ status:'ready-for-asset-review', assetUrl:'images/alpe-siusi.webp' })]);
    const image = document.querySelector('.bo-picture-candidate img');
    expect(image).not.toBeNull();
    expect(image.getAttribute('src')).toContain('alpe-siusi.webp');
  });

  test('no candidate ever renders an <img> without a source', async () => {
    await renderWith([
      candidate(),
      candidate({ status:'blocked' }),
      candidate({ status:'ready-for-asset-review', assetUrl:'images/alpe-siusi.webp' }),
    ]);
    const srcless = [...document.querySelectorAll('.bo-picture-candidate img')]
      .filter(image => !image.getAttribute('src'));
    expect(srcless).toEqual([]);
  });
});
