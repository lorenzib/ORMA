const fs = require('fs');
const path = require('path');

// Regression cover for the silent hazard drop.
//
// trail-hazards.js anchored its warning stack to selectors that trail.html did
// not have, so the script matched the hazard, built the card and discarded it
// without an error. Every existing hazard test asserted on source strings, and
// the source looked correct -- the failure only existed in the rendered DOM.
//
// So these tests load the REAL page files and run the REAL script against them.
// A synthetic fixture would pass forever; removing #ormaHazardMount from
// trail.html, or the badge strip from the generated pages, must fail here.

const root = __dirname;
const bodyOf = file => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if(!match) throw new Error(`no <body> found in ${file}`);
  return match[1];
};

const HAZARD = {
  id: 'test-hazard-1', state: 'active', severity: 'moderate',
  title: 'Thunderstorm warning for the test area',
  message: 'An official moderate thunderstorm warning applies to this area.',
  sourceLabel: 'MeteoAlarm Italy', sourceUrl: 'https://example.invalid/warning',
  expiresAt: '2026-09-05T17:59:00+00:00', trailIds: ['piancavallo'], trailSlugs: ['1-rafeil-rundweg'],
};

// Runs trail-hazards.js against one real page and returns the resulting DOM.
async function render(pageFile, url, hazards = [HAZARD]){
  jest.resetModules();
  window.history.replaceState({}, '', url);
  document.body.innerHTML = bodyOf(pageFile);
  document.head.innerHTML = '';
  global.fetch = jest.fn(() => Promise.resolve({ ok:true, json:() => Promise.resolve({ hazards }) }));
  require(path.join(root, 'trail-hazards.js'));
  // load() is async: let its fetch and the following microtasks settle.
  await new Promise(resolve => setTimeout(resolve, 0));
  return document.querySelector('.orma-hazard-stack');
}

describe('official area warnings reach the page', () => {
  // The route every browse and search result links to.
  test('the dynamic trail page renders a matching hazard', async () => {
    const stack = await render('trail.html', '/trail.html?id=piancavallo');
    expect(stack).not.toBeNull();
    expect(document.body.contains(stack)).toBe(true);
    expect(stack.textContent).toContain('Thunderstorm warning for the test area');
    // Placement matters as much as presence: a warning pushed to the top of the
    // document (the no-anchor fallback) or to the page foot is a degradation,
    // so pin it inside the trail content column.
    expect(stack.closest('.td2-wrap')).not.toBeNull();
  });

  test('the dynamic trail page carries the anchor the renderer needs', () => {
    document.body.innerHTML = bodyOf('trail.html');
    expect(document.getElementById('ormaHazardMount')).not.toBeNull();
  });

  // The generated pages use their badge strip as the anchor instead.
  test('a generated trail page renders a matching hazard', async () => {
    const page = fs.readdirSync(path.join(root, 'trails')).filter(f => f.endsWith('.html'))[0];
    const stack = await render(`trails/${page}`, `/trails/${page}`);
    expect(stack).not.toBeNull();
    expect(document.body.contains(stack)).toBe(true);
  });

  test('a warning is never dropped when the page offers no anchor at all', async () => {
    jest.resetModules();
    window.history.replaceState({}, '', '/trail.html?id=piancavallo');
    document.body.innerHTML = '<p>no mount, no badge strip, no main</p>';
    global.fetch = jest.fn(() => Promise.resolve({ ok:true, json:() => Promise.resolve({ hazards:[HAZARD] }) }));
    require(path.join(root, 'trail-hazards.js'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.querySelector('.orma-hazard-stack')).not.toBeNull();
  });

  test('a trail with no matching hazard renders nothing', async () => {
    const stack = await render('trail.html', '/trail.html?id=some-other-trail');
    expect(stack).toBeNull();
  });
});

// The report control lives in the same script and shares its anchor, but it has
// a second dependency: window.DoloPawsCommunity, assigned near the end of
// firebase-init.js. This file is injected dynamically, so it usually runs
// first -- and used to skip the control silently on every trail page.
describe("the hazard report control survives the module load order", () => {
  const stubCommunity = () => {
    window.DoloPawsCommunity = { reportTrailHazard: async () => ({ ok:true }) };
  };
  const clearCommunity = () => {
    delete window.DoloPawsCommunity;
    delete window.DoloPawsAuthReady;
  };

  async function boot(){
    jest.resetModules();
    window.history.replaceState({}, "", "/trail.html?id=piancavallo");
    document.body.innerHTML = bodyOf("trail.html");
    document.head.innerHTML = "";
    global.fetch = jest.fn(() => Promise.resolve({ ok:true, json:() => Promise.resolve({ hazards:[HAZARD] }) }));
    require(path.join(root, "trail-hazards.js"));
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  afterEach(clearCommunity);

  test("installs when the community module is already available", async () => {
    stubCommunity();
    window.DoloPawsAuthReady = true;
    await boot();
    expect(document.querySelector(".orma-hazard-report")).not.toBeNull();
  });

  // The regression: firebase-init.js finishes after this script has run.
  test("installs when the community module arrives late", async () => {
    clearCommunity();
    await boot();
    expect(document.querySelector(".orma-hazard-report")).toBeNull();

    stubCommunity();
    window.DoloPawsAuthReady = true;
    window.dispatchEvent(new window.CustomEvent("dolopaws-auth-ready"));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.querySelector(".orma-hazard-report")).not.toBeNull();
  });

  test("stays absent when the community module never appears", async () => {
    clearCommunity();
    await boot();
    window.dispatchEvent(new window.CustomEvent("dolopaws-auth-ready"));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.querySelector(".orma-hazard-report")).toBeNull();
  });
});
