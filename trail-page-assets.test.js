const { photoHtml, photoCreditHtml, publicAssetUrl, trailPageAssetUrl } = require('./scripts/generate-trail-pages');

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

  test('renders both legacy and owned-photo credits visibly', () => {
    const licensed = photoCreditHtml({
      imageIcon:'images/trail.jpg',
      imageCredit:'Jane Photographer · CC BY-SA 4.0',
      imageSourcePage:'https://example.com/source',
      imageCreator:'Jane Photographer',
      imageLicence:'CC BY-SA 4.0',
      imageLicenceUrl:'https://creativecommons.org/licenses/by-sa/4.0/',
    });
    expect(licensed).toContain('class="sp-photo-credit"');
    expect(licensed).toContain('Photo credit');
    expect(licensed).toContain('<a href="https://example.com/source"');
    expect(licensed).toContain('rel="license noopener"');
    expect(licensed).toContain('Cropped for display.');

    const owned = photoCreditHtml({
      imageIcon:'images/tre-cime-hero.jpg',
      imageCredit:{ text:'Benedetta Lorenzi · ORMA original' },
    });
    expect(owned).toContain('Photo: Benedetta Lorenzi · ORMA original');
    expect(owned).not.toContain('<a ');
  });
});
