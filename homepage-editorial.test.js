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

  test('keeps a prominent, value-first guest card above the homepage hero', () => {
    const html = read('index.html');
    const controller = read('homepage-search.js');
    const guestCard = html.indexOf('hp-guestbar--homepage');
    const hero = html.indexOf('class="hp-hero"');

    expect(guestCard).toBeGreaterThan(-1);
    expect(hero).toBeGreaterThan(guestCard);
    expect(html).toContain('Scores use a medium-dog profile.');
    expect(html).toContain('Create a free account only when you choose to save.');
    expect(controller).toContain("el.guestCta.textContent = 'Browse ' + state.custom.meta.name + '’s matches'");
  });

  test('places the profile explanation after the default score and keeps both profile prompts identical', () => {
    const html = read('index.html');
    const controller = read('homepage-search.js');
    const css = read('styles.css');
    const title = html.indexOf('Scores use a medium-dog profile.');
    const explanation = html.indexOf('Add your dog for personalised matches. Create a free account only when you choose to save.');

    expect(explanation).toBeGreaterThan(title);
    expect(html).toContain('class="hp-guestbar-cta hp-dog-profile-cta"');
    expect(controller).toContain('class="hp-coll-profile-cta hp-dog-profile-cta"');
    expect(read('mobile-nav.js')).toContain("profile.className = 'hp-prefooter-action is-primary hp-dog-profile-cta'");
    expect(css).toContain('.hp-dog-profile-cta{');
    expect(css).toContain('width:224px;');
    expect(css).toContain('min-height:42px;');
  });

  test('shows the value of a dog profile before asking the guest to register', () => {
    const controller = read('homepage-search.js');

    expect(controller).toContain("dogName + '’s profile is ready'");
    expect(controller).toContain("matches.slice(0, 3)");
    expect(controller).toContain('Save profile and see all matches');
    expect(controller).toContain('See all matches without saving');
    expect(controller).toContain("openSignup({ next: 'browse-trails.html' })");
  });

  test('uses the compact guest notice only on the ranking catalogue', () => {
    const browse = read('browse-trails.html');

    expect(browse).toContain('hp-guestbar--compact');
    expect(browse).toContain('Guest mode · Scores use a medium-dog profile.');
    expect(browse).toContain('href="index.html?wizard=1">Add your dog</a>');
    expect(browse).not.toContain('hp-guestbar--homepage');
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

  test('keeps the method cards on the same three-column rhythm as featured trails', () => {
    const css = read('homepage-editorial.css');
    const js = read('homepage-search.js');

    expect(css).toContain('.hp-how-grid{grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:16px;}');
    expect(css).toContain('.hp-howcard{display:flex;flex-direction:column;width:100%;min-width:0;height:100%');
    expect(css).toContain('.hp-howcard-media{position:relative;flex:0 0 178px;height:178px;');
    expect(css).not.toContain('mix-blend-mode:soft-light');
    expect(js).toContain('orma-how-assess-1920.jpg');
    expect(js).toContain('orma-how-dog-1920.jpg');
    expect(js).toContain('orma-how-match-1920.jpg');
    expect(js).toContain('width="960" height="600"');
  });

  test('uses the shared wider website canvas', () => {
    const css = read('homepage-editorial.css');
    expect(css).toContain('.hp-content{max-width:1440px;padding:50px clamp(28px,4vw,52px) 44px;}');
    expect(read('index.html')).toContain('homepage-editorial.css?v=20260821-6');
  });
});
