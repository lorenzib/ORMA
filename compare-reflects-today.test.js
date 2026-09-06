const fs = require('fs');
const weatherWindow = require('./trail-weather-window');
const homeConditions = require('./homepage-conditions');

// Compare holds at most three trails and they can sit in different regions, so
// the homepage's single area reading would be meaningless across them. Each
// trail gets its own forecast, corrected to its own summit.

function reply(temperatureC, elevation){
  return { ok:true, json: async () => ({ elevation,
    current:{ time:'2026-07-15T13:00', temperature_2m:temperatureC },
    hourly:{ time:['2026-07-15T13:00'], temperature_2m:[temperatureC] } }) };
}

const HOT_VALLEY = { id:'valley', lat:45.0, lng:6.0, elevationProfile:[{ elev:1000 }] };
const COOL_RIDGE = { id:'ridge', lat:46.5, lng:11.6, elevationProfile:[{ elev:2500 }] };

describe('compare scores each trail against its own day', () => {
  test('trails in different places get their own forecasts', async () => {
    const seen = [];
    const root = { DoloPawsWeatherWindow: weatherWindow, fetch: async url => {
      seen.push(url);
      return url.includes('45') ? reply(30, 1000) : reply(30, 1000);
    } };
    const area = homeConditions.create(root);
    const found = await area.loadTrails([HOT_VALLEY, COOL_RIDGE]);

    expect(seen.length).toBe(2);
    expect(found.get('valley').heatRisk).toBe('high');
    // Same 30C reading, but 1500m higher is about 10C cooler.
    expect(found.get('ridge').heatRisk).not.toBe('high');
  });

  test('a trail whose forecast fails is simply scored without one', async () => {
    const root = { DoloPawsWeatherWindow: weatherWindow,
      fetch: async url => (url.includes('45') ? reply(30, 1000) : { ok:false }) };
    const found = await homeConditions.create(root).loadTrails([HOT_VALLEY, COOL_RIDGE]);
    expect(found.has('valley')).toBe(true);
    expect(found.has('ridge')).toBe(false);
  });

  test('never more than the three trails compare allows', async () => {
    let calls = 0;
    const root = { DoloPawsWeatherWindow: weatherWindow,
      fetch: async () => { calls += 1; return reply(20, 1000); } };
    const many = [1,2,3,4,5].map(n => ({ id:'t'+n, lat:46, lng:11, elevationProfile:[{ elev:1200 }] }));
    await homeConditions.create(root).loadTrails(many);
    expect(calls).toBe(3);
  });
});

describe('compare is wired to use it', () => {
  const page = fs.readFileSync('./compare-page.js', 'utf8');
  const html = fs.readFileSync('./compare.html', 'utf8');

  test('the comparison passes conditions into the engine', () => {
    expect(page).toContain('recommendTrail(trail, subject, conditionsFor(trail))');
  });

  test('the page loads the modules that supply them', () => {
    expect(html).toContain('trail-weather-window.js');
    expect(html).toContain('homepage-conditions.js');
  });
});
