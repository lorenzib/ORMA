const fs = require('fs');
const path = require('path');

const authUi = fs.readFileSync(path.join(__dirname, 'auth-ui.js'), 'utf8');

function pages(){
  return fs.readdirSync(__dirname)
    .filter(name => name.endsWith('.html'))
    .filter(name => !/^(backoffice|community-moderation|trail-verify)/.test(name));
}

describe('the login dialog has one definition', () => {
  test('no page ships its own copy', () => {
    // index.html carried one and auth-ui.js injected the same dialog
    // everywhere else, which is exactly how two copies drift: the homepage's
    // hero grew a responsive <picture> and a cache-busted logo while the other
    // fourteen pages kept a single full-size image and an older logo.
    const shipping = pages().filter(name =>
      fs.readFileSync(path.join(__dirname, name), 'utf8').includes('id="authModal"'));
    expect(shipping).toEqual([]);
  });

  test('every page that offers login loads the script that defines it', () => {
    // Removing the markup only works while the script is there to inject it.
    const offering = pages().filter(name => {
      const html = fs.readFileSync(path.join(__dirname, name), 'utf8');
      return html.includes('id="accountBtn"') || html.includes('DoloPawsAuthUI');
    });
    expect(offering.length).toBeGreaterThan(0);
    // Directly, or inside the trail bundle, which lists auth-ui.js among its
    // ordered sources.
    offering.forEach(name => {
      const html = fs.readFileSync(path.join(__dirname, name), 'utf8');
      expect(html).toMatch(/auth-ui\.js\?v=|trail-app\.bundle\.js\?v=/);
    });
    const bundle = fs.readFileSync(path.join(__dirname, 'scripts/build-trail-page-bundle.js'), 'utf8');
    expect(bundle).toContain("'auth-ui.js'");
  });

  test('a page that somehow has one is not given a second', () => {
    // Duplicate ids would break every getElementById in this file.
    expect(authUi).toContain("if(!document.getElementById('authModal') && document.body){");
  });

  test('the dialog kept the responsive hero, not the homepage-only one', () => {
    const markup = authUi.slice(authUi.indexOf('host.innerHTML ='), authUi.indexOf('document.body.appendChild'));
    expect(markup).toContain('images/lago-di-braies-480.webp 480w');
    expect(markup).toContain('sizes="(max-width: 640px) 100vw, 560px"');
    // Dimensions prevent the dialog reflowing around the photo as it lands.
    expect(markup).toContain('width="900" height="1200"');
    expect(markup).toContain('logo.svg?v=5');
  });

  test('the photo still costs nothing until the dialog is opened', () => {
    const markup = authUi.slice(authUi.indexOf('host.innerHTML ='), authUi.indexOf('document.body.appendChild'));
    // Neither the sources nor the image may carry a real URL in the markup.
    expect(markup).not.toMatch(/\ssrcset="/);
    expect(markup).not.toMatch(/<img[^>]*\ssrc="images\//);
    expect(markup).toContain('data-authsrcset');
    expect(markup).toContain('data-authsrc=');
  });

  test('opening promotes the sources before the image', () => {
    // src first makes the browser commit to the fallback, and the responsive
    // variants never get a say — the bug this refactor would otherwise ship.
    const open = authUi.slice(authUi.indexOf('const heroImg = modal.querySelector'));
    const sources = open.indexOf('source.srcset = source.dataset.authsrcset');
    const image = open.indexOf('heroImg.src = heroImg.dataset.authsrc');
    expect(sources).toBeGreaterThan(-1);
    expect(image).toBeGreaterThan(sources);
  });
});
