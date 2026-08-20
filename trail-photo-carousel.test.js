/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const photoProvenance = require('./trail-photo-provenance');

describe('trail photo carousel', () => {
  test('opens a clicked thumbnail and supports next, previous, and escape controls', async () => {
    document.body.innerHTML = `
      <button id="addReportBtn" type="button">Report</button>
      <button id="addReviewBtn" type="button">Review</button>
      <button id="addPhotoBtn" type="button">Photo</button>
      <button id="trailPhotosPrev" type="button" hidden>Previous photos</button>
      <button id="trailPhotosNext" type="button" hidden>Next photos</button>
      <div id="trailFlagsList"></div>
      <div id="trailReviewsList"></div>
      <div id="trailPhotosList"></div>
      <div id="communityRating"></div>
      <div id="heroRating"></div>`;

    window.t = key => key;
    window.DoloPawsAuth = { currentUser:null };
    window.DoloPawsPhotoProvenance = photoProvenance;
    window.DoloPawsCommunityStates = {
      isPublic:() => true,
      countsTowardRating:() => true,
      hazardIsExpired:() => false,
      hazardTrustState:() => 'unconfirmed',
    };
    window.DoloPawsCommunity = {
      getActiveFlags:jest.fn().mockResolvedValue([]),
      getReviews:jest.fn().mockResolvedValue([]),
      getTrailPhotos:jest.fn().mockResolvedValue([
        { status:'approved', image:'data:image/jpeg;base64,ONE', caption:'First view' },
        { status:'approved', image:'data:image/jpeg;base64,TWO', caption:'Second view' },
        { status:'approved', image:'data:image/jpeg;base64,THREE', caption:'Third view' },
      ]),
    };

    const source = fs.readFileSync(path.join(__dirname, 'trail-reports.js'), 'utf8');
    window.eval(`${source}\nwindow.__initTrailReports = initTrailReports;`);
    window.__initTrailReports(null, {
      id:'test-trail',
      name:'Test trail',
      path:[],
      editorialPhotos:[{
        source:'orma-editorial',
        image:'images/tre-cime-gallery-01.jpg',
        alt:'Tre Cime from the circuit trail',
        caption:'Tre Cime di Lavaredo from the circuit trail',
        credit:{ text:'Benedetta Lorenzi · ORMA original' },
      }],
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    const thumbnails = document.querySelectorAll('.community-photo__open');
    expect(thumbnails).toHaveLength(4);
    expect(thumbnails[0].querySelector('img').getAttribute('src')).toBe('images/tre-cime-gallery-01.jpg');
    expect(document.querySelector('.community-photo figcaption')).toBeNull();
    expect(document.getElementById('trailPhotosNext').hidden).toBe(false);

    thumbnails[2].click();
    const viewer = document.querySelector('.trail-photo-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer.querySelector('[data-gallery-caption]').textContent).toBe('Second view');
    expect(viewer.querySelector('[data-gallery-count]').textContent).toBe('3 of 4');

    viewer.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowRight', bubbles:true }));
    expect(viewer.querySelector('[data-gallery-caption]').textContent).toBe('Third view');
    expect(viewer.querySelector('[data-gallery-count]').textContent).toBe('4 of 4');

    viewer.querySelector('[data-gallery-prev]').click();
    expect(viewer.querySelector('[data-gallery-caption]').textContent).toBe('Second view');

    viewer.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    expect(document.querySelector('.trail-photo-viewer')).toBeNull();
    expect(document.body.classList.contains('trail-photo-viewer-open')).toBe(false);
    expect(document.activeElement).toBe(thumbnails[2]);
  });
});
