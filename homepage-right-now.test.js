const scoring = require('./scoring/recommendation-v1.js');
const weatherWindow = require('./trail-weather-window');
const homeConditions = require('./homepage-conditions');
const fs = require('fs');

// #203 made the trail page conditions-aware and left every list view scoring on
// yesterday's terms, so the same trail could show two different numbers on two
// screens. These pin the two together.

const HEAT_SENSITIVE = { name:'Teo', fitness:'moderate', conditions:['heat'], weightBand:'30-40' };
const TRAIL = { id:'t', name:'Test', distance:5, ascent:200, elevationProfile:[{ km:0, elev:1000 }] };

function score(conditions){
  return scoring.calculateRecommendation({ dog:HEAT_SENSITIVE, trail:TRAIL, currentConditions:conditions }).score;
}

describe('the homepage ranks for today, on the same terms as the trail page', () => {
  test('the same conditions produce the same score wherever they are applied', async () => {
    const root = { DoloPawsWeatherWindow: weatherWindow, fetch: async () => ({ ok:true,
      json: async () => ({ elevation:1000, current:{ time:'2026-07-15T13:00', temperature_2m:30 },
        hourly:{ time:['2026-07-15T13:00'], temperature_2m:[30] } }) }) };
    const area = homeConditions.create(root);
    await area.load(46.5, 11.6);

    // What the homepage would hand the engine for this trail.
    const fromHomepage = area.forTrail(TRAIL);
    // What the trail page hands it for the same trail on the same day.
    const fromTrailPage = weatherWindow.scoringConditions(
      weatherWindow.currentConditions({ currentTime:'2026-07-15T13:00', temperatureC:30 }));

    expect(fromHomepage.heatRisk).toBe(fromTrailPage.heatRisk);
    expect(score(fromHomepage)).toBe(score(fromTrailPage));
  });

  test('heat actually costs a heat-sensitive dog points', () => {
    const hot = weatherWindow.currentConditions({ currentTime:'2026-07-15T13:00', temperatureC:30 });
    const cool = weatherWindow.currentConditions({ currentTime:'2026-07-15T07:00', temperatureC:10 });
    expect(score(hot)).toBeLessThan(score(cool));
  });

  test('with no forecast the score is exactly what it was before', () => {
    expect(score(undefined)).toBe(score({ status:'not-provided' }));
  });
});

describe('the homepage is wired to use it', () => {
  const search = fs.readFileSync('./homepage-search.js', 'utf8');
  const script = fs.readFileSync('./script.js', 'utf8');
  const index = fs.readFileSync('./index.html', 'utf8');

  test('both renderers pass conditions into the engine', () => {
    expect(search).toContain('scoreTrail(t, effectiveOverrides(activeProfile(), null), conditionsFor(t))');
    // script.js renders the signed-in list; wiring only one of the two is what
    // produced the mismatch in the first place.
    expect(script).toContain('recommendTrail(trail, overrides, liConditionsFor(trail))');
    expect(script).toContain('recommendTrail(t, overrides, liConditionsFor(t))');
  });

  test('the page loads the modules the wiring depends on', () => {
    expect(index).toContain('trail-weather-window.js');
    expect(index).toContain('homepage-conditions.js');
    expect(index).toContain('id="liToday"');
  });

  test('the signed-in list repaints when the forecast lands', () => {
    expect(script).toContain("addEventListener('dolopaws-area-conditions-ready'");
  });
});
