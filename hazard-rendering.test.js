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
  message: 'An official moderate thunderstorm warning applies to this area. Check the source and local conditions before setting out. This is not a trail-closure notice.',
  sourceLabel: 'MeteoAlarm Italy', sourceUrl: 'https://example.invalid/warning',
  expiresAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(), trailIds: ['piancavallo'], trailSlugs: ['1-rafeil-rundweg'],
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
    // Official warnings collapse to one static advisory strip — no expandable
    // card, no boilerplate — that names the hazard, the caveat, expiry and source.
    const warning = stack.querySelector('.orma-hazard');
    expect(warning.classList.contains('orma-hazard--advisory')).toBe(true);
    expect(warning.tagName).not.toBe('DETAILS');
    expect(warning.querySelector('.orma-hazard__toggle')).toBeNull();
    expect(warning.querySelector('.orma-hazard__title').textContent).toBe('Moderate thunderstorm warning · the test area');
    const detail = warning.querySelector('.orma-hazard__detail');
    expect(detail.textContent).toContain('Wider-area, not a trail closure');
    expect(detail.textContent).toMatch(/valid until /i);
    expect(detail.querySelector('a').textContent).toBe('Check MeteoAlarm Italy ↗');
    // The generic "official warning. Check the source…" boilerplate is gone.
    expect(warning.textContent).not.toContain('Check the source and local conditions');
    // Placement matters as much as presence: a warning pushed to the top of the
    // document (the no-anchor fallback) or to the page foot is a degradation, so
    // pin it inside the trail-weather card, beside the forecast it qualifies.
    expect(stack.closest('.td2-hero-weather')).not.toBeNull();
    // The advisory line carries the count; no kicker repeats it above.
    expect(stack.querySelector('.orma-hazard-stack__kick')).toBeNull();
    // Phones move the weather card below the map; the hero keeps a pointer.
    const pointer = document.getElementById('ormaHazardPointer');
    expect(pointer.hidden).toBe(false);
    expect(pointer.textContent).toBe('Area warning · see trail weather');
    expect(pointer.getAttribute('href')).toBe('#mobileWeatherSlot');
    // Following it reopens a collapsed weather card and scrolls to the stack.
    const card = document.querySelector('.td2-hero-weather');
    card.classList.add('is-mobile-collapsed');
    card.querySelector('.td2-mobile-card-toggle').setAttribute('aria-expanded', 'false');
    const scrolled = jest.fn();
    Element.prototype.scrollIntoView = scrolled;
    pointer.click();
    expect(card.classList.contains('is-mobile-collapsed')).toBe(false);
    expect(card.querySelector('.td2-mobile-card-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(scrolled.mock.instances[0]).toBe(stack);
    delete Element.prototype.scrollIntoView;
    // The recommendation card reads the same warnings, so the two never disagree.
    expect(window.OrmaAreaWarnings).toEqual([{
      id:'test-hazard-1', event:'Thunderstorm warning for the test area',
      title:'Thunderstorm warning for the test area', severity:'moderate',
    }]);
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

  test('a warning past its own expiry renders nothing, however stale the snapshot', async () => {
    const expired = { ...HAZARD, id:'test-hazard-expired', expiresAt:new Date(Date.now() - 60 * 1000).toISOString() };
    const stack = await render('trail.html', '/trail.html?id=piancavallo', [expired]);
    expect(stack).toBeNull();
    expect(document.getElementById('ormaHazardPointer').hidden).toBe(true);
    expect(window.OrmaAreaWarnings).toEqual([]);
    // An unreadable expiry is not evidence of safety: the warning stays.
    const odd = await render('trail.html', '/trail.html?id=piancavallo', [{ ...HAZARD, expiresAt:'when the rain stops' }]);
    expect(odd).not.toBeNull();
  });

  test('a trail with no matching hazard renders nothing', async () => {
    const stack = await render('trail.html', '/trail.html?id=some-other-trail');
    expect(stack).toBeNull();
    expect(document.getElementById('ormaHazardPointer').hidden).toBe(true);
  });
});

describe('community hazards and the map-first report control', () => {
  afterEach(() => {
    delete window.DoloPawsCommunity;
    delete window.DoloPawsTrailMapContext;
    delete window.DoloPawsStartTrailMap;
    delete window.OrmaHazardLocation;
  });

  test('a vetted community report appears in Hazards reported, not the official warning stack', async () => {
    const reported = {
      ...HAZARD,
      id:'reported-hazard-1',
      origin:'community',
      verificationState:'reported-unverified',
      at:{ km:2.4, lat:46.54, lng:11.71, onRoute:true },
    };
    const stack = await render('trail.html', '/trail.html?id=piancavallo', [reported]);
    expect(stack).toBeNull();
    const item = document.querySelector('#trailPublishedHazards [data-hazard-item]');
    expect(item).not.toBeNull();
    expect(item.textContent).toContain('not yet confirmed');
  });

  test('binds the map button without creating the old detached form', async () => {
    await render('trail.html', '/trail.html?id=piancavallo');
    const button = document.getElementById('addReportBtn');
    expect(button.closest('#trailMapBox')).not.toBeNull();
    expect(button.dataset.ormaHazardBound).toBe('true');
    expect(document.querySelector('.orma-hazard-report')).toBeNull();
  });

  test('requests a lazy map when the map button is pressed', async () => {
    const start = jest.fn();
    window.DoloPawsStartTrailMap = start;
    await render('trail.html', '/trail.html?id=piancavallo');
    document.getElementById('addReportBtn').click();
    expect(start).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.orma-hazard-report')).toBeNull();
  });
});
