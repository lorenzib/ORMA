const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

/**
 * The body of one function. Bounded by the next declaration rather than a
 * named one: naming the wrong neighbour gives an empty slice, and every
 * assertion against an empty string passes for the wrong reason.
 */
function bodyOf(name){
  const start = script.indexOf(`function ${name}(`);
  if(start < 0) throw new Error(`${name} not found`);
  const next = script.indexOf('\nfunction ', start + 1);
  const body = script.slice(start, next < 0 ? undefined : next);
  if(body.length < 40) throw new Error(`${name} sliced to nothing`);
  return body;
}
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

describe('arriving without having chosen a place', () => {
  test('a member lands on the map, not on a question', () => {
    // The map, the list and the ranking all existed and were all withheld
    // until someone answered where they were going.
    const loader = bodyOf('liLoadLocationContext');
    expect(loader).toContain('return liEverywhereContext();');
    expect(loader).not.toContain('return null;');
  });

  test('everywhere is a true answer, and passes every trail', () => {
    // country, region and valley all 'all' is what the area filter already
    // treats as no constraint, so this needs no special case downstream.
    const everywhere = bodyOf('liEverywhereContext');
    expect(everywhere).toContain("country:'all'");
    expect(everywhere).toContain("region:'all'");
    expect(everywhere).toContain("valley:'all'");
  });

  test('the starting point is never saved as a preference', () => {
    // Transient: someone who has not chosen has not chosen, and should not
    // find "All areas" waiting for them as though they had.
    const everywhere = bodyOf('liEverywhereContext');
    expect(everywhere).toContain('transient:true');
    expect(everywhere).toContain('everywhere:true');
  });

  test('it is told apart from someone who chose both regions', () => {
    // A flag, not a label comparison: the label is copy and will be rewritten.
    expect(script).toContain('const everywhere = !!(liLocationContext && liLocationContext.everywhere);');
    expect(script).toContain("...(value.everywhere ? { everywhere:true } : {}),");
  });

  test('the heading does not name a place that is not one', () => {
    // "Best walk for Eddie in All areas today" reads as a location called
    // All areas.
    expect(bodyOf('liRecommendationLocationPhrase')).toMatch(/if\(liLocationContext\.everywhere\) return '';/);
    // And the gap it leaves does not become a double space.
    expect(script).toMatch(/\.replace\(\/\\s\{2,\}\/g, ' '\)\.trim\(\)/);
  });

  test('the gate is now only for changing a place you have', () => {
    const render = bodyOf('liRenderLocationContext');
    expect(render).toContain('if(changing) liPopulateAreaPicker();');
    expect(render).not.toContain('if(!ready) liPopulateAreaPicker();');
  });

  test('resetting the location returns to everywhere, not to nothing', () => {
    // Nothing would blank the workspace the wall used to stand in front of.
    const reset = bodyOf('liResetLocationContext');
    expect(reset).toContain('liLocationContext = liEverywhereContext();');
    expect(reset).toContain("detail:{ ready:true }");
  });
});

describe('the offer to show what is near you', () => {
  test('it is offered over the map, not in front of it', () => {
    expect(html).toContain('id="liNearbyAsk"');
    // Inside the map, after the map itself: the walks are already usable.
    expect(html.indexOf('id="liNearbyAsk"')).toBeGreaterThan(html.indexOf('id="trailMap"'));
    expect(css).toContain('.li-nearby-ask{');
    expect(css).toMatch(/\.li-nearby-ask\{[\s\S]*?position:absolute/);
  });

  test('it is asked once, whichever way it is answered', () => {
    // Someone who said no should not be asked again every visit.
    const ask = bodyOf('liNearbyAskAnswered');
    expect(ask).toContain('LI_LOCATION_ASK_KEY');
    expect(script).toMatch(/liRememberNearbyAsk\(\);[\s\S]{0,400}error\.code === 1/);
  });

  test('it is not offered where it cannot work', () => {
    const render = bodyOf('liRenderNearbyAsk');
    expect(render).toContain('navigator.geolocation');
    // Only while nobody has chosen a place.
    expect(render).toContain('ask.hidden = !(everywhere && possible && !liNearbyAskAnswered());');
  });

  test('a refusal costs nothing, because the walks are already there', () => {
    const asking = bodyOf('liAskForNearby');
    expect(asking).toMatch(/Every area stays listed/);
    // And it does not leave the button saying "Finding you…" for ever.
    expect(asking).toMatch(/yes\.disabled = false; yes\.textContent = 'Use my location';[\s\S]{0,200}liRememberNearbyAsk\(\)/);
  });

  test('on a phone it clears the controls already at the top of the map', () => {
    // The results sheet owns the bottom, Layers and Expand own the top.
    expect(css).toMatch(/body\.mhome-active \.li-nearby-ask\{bottom:auto;top:56px;/);
  });
});
