const fs = require('fs');
const path = require('path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('guest homepage editorial structure', () => {
  test('uses the clear dog-first hero proposition', () => {
    const html = read('index.html');
    const translations = read('i18n.js');

    expect(html).toContain('Find a trail that fits your dog');
    expect(translations).toContain("'hero.h1': 'Find a trail that fits your dog'");
  });

  test('orders mission, method, and weekly feature as one page story', () => {
    const controller = read('homepage-search.js');
    const mission = controller.indexOf('<section class="hp-mission"');
    const method = controller.indexOf('<section class="hp-how"');
    const featured = controller.indexOf('<section class="hp-featured"');

    expect(mission).toBeGreaterThan(-1);
    expect(method).toBeGreaterThan(mission);
    expect(featured).toBeGreaterThan(method);
    expect(controller).toContain('The route must adapt to the dog, never the other way around.');
    expect(controller).toContain('– ORMA Team');
  });

  test('rotates the weekly feature through the editorial Collections catalogue', () => {
    const html = read('index.html');
    const controller = read('homepage-search.js');

    expect(html.indexOf('collections-data.js')).toBeLessThan(html.indexOf('homepage-search.js'));
    expect(controller).toContain('DoloPawsCollections');
    expect(controller).toContain('catalogue.trailsFor(collection, trails)');
    expect(controller).not.toContain('var THEMES');
  });

  test('keeps the mission quote inside the mission instead of a detached footer block', () => {
    expect(read('homepage-search.js')).toContain('class="hp-mission-quote"');
    expect(read('index.html')).not.toContain('class="wrap hp-quote"');
  });

  test('does not present a regional trail count as the whole catalogue', () => {
    expect(read('index.html')).not.toContain('hpAnnounce');
    expect(read('homepage-search.js')).not.toContain('announceCount');
    expect(read('homepage-search.js')).toContain('each published trail');
  });

  test('wraps the featured match beneath the risk badge when a card narrows', () => {
    const css = read('homepage-editorial.css');

    expect(css).toContain('.hp-featured .hp-ccard-footer{flex-wrap:wrap;row-gap:10px;}');
    expect(css).toContain('.hp-featured .hp-ccard-rating{min-width:max-content;}');
    expect(css).toContain('.hp-featured .hp-ccard-match{margin-left:auto;}');
    expect(css).toContain('@container (max-width:340px)');
    expect(css).toContain('.hp-featured .hp-ccard-match{align-self:flex-end;margin-left:0;}');
  });
});
