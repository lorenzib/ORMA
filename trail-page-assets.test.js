const { photoHtml, publicAssetUrl, trailPageAssetUrl } = require('./scripts/generate-trail-pages');

describe('generated trail page assets', () => {
  test('keeps approved remote trail photography absolute', () => {
    const image = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Trail.jpg';
    expect(trailPageAssetUrl(image)).toBe(image);
    expect(publicAssetUrl(image)).toBe(image);
    expect(photoHtml({ name:'Trail name', imageIcon:image, imageAlt:'Exact approved alt text' }))
      .toContain(`src="${image}" alt="Exact approved alt text"`);
  });

  test('keeps repository assets relative to generated trail pages', () => {
    expect(trailPageAssetUrl('images/trail.jpg')).toBe('../images/trail.jpg');
    expect(publicAssetUrl('images/trail.jpg')).toBe('https://www.app-orma.com/images/trail.jpg');
  });
});
