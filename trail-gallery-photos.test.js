/** @jest-environment jsdom */

const fs = require('fs');
const path = require('path');
const provenance = require('./trail-photo-provenance');
const { applyTrailGalleryPhotos } = require('./scripts/trail-gallery-photos');
const { loadProductionTrails } = require('./scripts/load-production-trails');

const root = __dirname;
const gallery = JSON.parse(fs.readFileSync(path.join(root, 'data/trail-gallery-photos.json'), 'utf8'));

const photo = {
  image:'images/trails/test-trail-meadow.jpg',
  alt:'A meadow path',
  title:'Meadow path',
  creator:'Jane Photographer',
  licence:'CC BY-SA 4.0',
  licenceUrl:'https://creativecommons.org/licenses/by-sa/4.0/',
  sourcePage:'https://commons.wikimedia.org/wiki/File:Meadow.jpg',
};
const trail = { id:'test-trail', heroImage:'images/trails/test-trail-hero.jpg', imageSourcePage:'https://commons.wikimedia.org/wiki/File:Hero.jpg' };

describe('trail gallery photos', () => {
  test('a gallery photo reaches the trail record', () => {
    const [next] = applyTrailGalleryPhotos([trail], { trails:[{ id:'test-trail', photos:[photo] }] });
    expect(next.licensedPhotos).toEqual([photo]);
  });

  test('a photo without its licence, creator or Commons source is refused', () => {
    for (const broken of [
      { ...photo, licence:'All rights reserved' },
      { ...photo, creator:'' },
      { ...photo, sourcePage:'https://example.com/photo' },
      { ...photo, licenceUrl:'' },
      { ...photo, image:'https://upload.wikimedia.org/x.jpg' },
    ]) {
      expect(() => applyTrailGalleryPhotos([trail], { trails:[{ id:'test-trail', photos:[broken] }] })).toThrow();
    }
  });

  test('the hero is not shown again, and two photos is the most', () => {
    expect(() => applyTrailGalleryPhotos([trail], { trails:[{ id:'test-trail', photos:[{ ...photo, sourcePage:trail.imageSourcePage }] }] })).toThrow(/hero/);
    expect(() => applyTrailGalleryPhotos([trail], { trails:[{ id:'test-trail', photos:[photo, photo, photo] }] })).toThrow(/two/);
  });

  test('every committed gallery photo is in the repository and used once', () => {
    const trails = loadProductionTrails(root);
    const heroes = trails.map(t => t.heroImage).filter(Boolean);
    const heroPages = trails.map(t => t.imageSourcePage).filter(Boolean);
    const images = gallery.trails.flatMap(entry => entry.photos.map(p => p.image));
    const pages = gallery.trails.flatMap(entry => entry.photos.map(p => p.sourcePage));
    images.forEach(image => expect(fs.existsSync(path.join(root, image))).toBe(true));
    expect(new Set(images).size).toBe(images.length);
    expect(new Set(pages).size).toBe(pages.length);
    expect(images.filter(image => heroes.includes(image))).toEqual([]);
    expect(pages.filter(page => heroPages.includes(page))).toEqual([]);
  });

  test('the credit names the photographer and the licence', () => {
    const [shown] = provenance.licensedPhotos({ licensedPhotos:[photo] });
    expect(shown).toMatchObject({ isLicensed:true, status:'approved' });
    expect(provenance.photoCaption(shown)).toBe('Photo: Jane Photographer · CC BY-SA 4.0');
    expect(provenance.photoAlt(shown)).toBe('A meadow path');
    expect(provenance.licensedPhotos({ licensedPhotos:[{ ...photo, image:'https://example.com/x.jpg' }] })).toEqual([]);
  });

  test('the Photos section shows it after shared photos, credited and linked', async () => {
    document.body.innerHTML = `
      <button id="addReportBtn" type="button">Report</button>
      <button id="addReviewBtn" type="button">Review</button>
      <button id="addPhotoBtn" type="button">Photo</button>
      <button id="trailPhotosPrev" type="button" hidden></button>
      <button id="trailPhotosNext" type="button" hidden></button>
      <div id="trailFlagsList"></div>
      <div id="trailReviewsList"></div>
      <div id="trailPhotosList"></div>
      <div id="communityRating"></div>
      <div id="heroRating"></div>`;
    window.t = key => key;
    window.DoloPawsAuth = { currentUser:null };
    window.DoloPawsPhotoProvenance = provenance;
    window.DoloPawsCommunityStates = {
      isPublic:() => true,
      countsTowardRating:() => true,
      hazardIsExpired:() => false,
      hazardTrustState:() => 'unconfirmed',
    };
    window.DoloPawsCommunity = {
      getActiveFlags:jest.fn().mockResolvedValue([]),
      getReviews:jest.fn().mockResolvedValue([]),
      getTrailPhotos:jest.fn().mockResolvedValue([{ status:'approved', image:'data:image/jpeg;base64,ONE', caption:'Shared view' }]),
    };
    const source = fs.readFileSync(path.join(root, 'trail-reports.js'), 'utf8');
    window.eval(`${source}\nwindow.__initTrailReports = initTrailReports;`);
    window.__initTrailReports(null, { id:'test-trail', name:'Test trail', path:[], licensedPhotos:[photo] });
    await new Promise(resolve => setTimeout(resolve, 0));

    const tiles = document.querySelectorAll('.community-photo');
    expect(tiles).toHaveLength(2);
    expect(tiles[0].querySelector('img').getAttribute('src')).toBe('data:image/jpeg;base64,ONE');
    expect(tiles[1].querySelector('figcaption').textContent).toBe('Jane Photographer · CC BY-SA 4.0');

    tiles[1].querySelector('.community-photo__open').click();
    const caption = document.querySelector('[data-gallery-caption]');
    const links = [...caption.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(caption.textContent).toBe('Photo: Jane Photographer · CC BY-SA 4.0');
    expect(links).toEqual([photo.sourcePage, photo.licenceUrl]);
  });
});
