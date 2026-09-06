const weatherWindow = require('./trail-weather-window');
const homeConditions = require('./homepage-conditions');

// One area forecast has to serve a list spanning roughly 900m to 2500m. These
// pin the altitude correction, because without it the same reading would call a
// cool ridge hot -- and the score would inherit that.

function payload({ temperatureC, elevation = 1000, hour = '13:00' }){
  const times = []; const temps = [];
  for(let h = 0; h < 24; h += 1){
    times.push(`2026-07-15T${String(h).padStart(2, '0')}:00`);
    temps.push(temperatureC);
  }
  return { elevation, current:{ time:`2026-07-15T${hour}`, temperature_2m:temperatureC },
    hourly:{ time:times, temperature_2m:temps } };
}

function makeArea(options){
  const root = { DoloPawsWeatherWindow: weatherWindow,
    fetch: async () => ({ ok:true, json: async () => payload(options) }) };
  return homeConditions.create(root);
}

const trailAt = metres => ({ elevationProfile:[{ km:0, elev:metres }, { km:1, elev:metres }] });

describe('area conditions are corrected for each trail altitude', () => {
  test('reads the highest point from the elevation profile', () => {
    expect(homeConditions.highestPoint({ elevationProfile:[{ elev:1200 }, { elev:1850 }, { elev:1400 }] })).toBe(1850);
    expect(homeConditions.highestPoint({})).toBeNull();
  });

  test('a valley reading does not make a high ridge hot', async () => {
    // 28C at 1000m. A summit 1500m higher is about 10C cooler.
    const area = makeArea({ temperatureC:28, elevation:1000 });
    expect(await area.load(46.5, 11.6)).toBe(true);

    expect(area.forTrail(trailAt(1000)).heatRisk).toBe('high');
    expect(area.forTrail(trailAt(2500)).heatRisk).not.toBe('high');
  });

  test('a trail with no elevation profile keeps the area reading', async () => {
    // Overstating heat is the safe direction to be wrong in.
    const area = makeArea({ temperatureC:28, elevation:1000 });
    await area.load(46.5, 11.6);
    expect(area.forTrail({}).heatRisk).toBe(area.forTrail(trailAt(1000)).heatRisk);
  });

  test('no forecast means conditions are omitted, never guessed', async () => {
    const root = { DoloPawsWeatherWindow: weatherWindow, fetch: async () => ({ ok:false }) };
    const area = homeConditions.create(root);
    expect(await area.load(46.5, 11.6)).toBe(false);
    expect(area.forTrail(trailAt(1500))).toBeUndefined();
    expect(area.band()).toBeNull();
  });

  test('a stale snapshot stops being offered to the score', async () => {
    const area = makeArea({ temperatureC:28, elevation:1000 });
    await area.load(46.5, 11.6, { at: Date.now() - (31 * 60 * 1000) });
    expect(area.forTrail(trailAt(1000)).status).toBe('not-provided');
  });

  test('the band describes the area, and says when heat arrives', async () => {
    const hot = makeArea({ temperatureC:30, elevation:1000 });
    await hot.load(46.5, 11.6);
    expect(hot.band().tone).toBe('high');

    const cool = makeArea({ temperatureC:8, elevation:1000 });
    await cool.load(46.5, 11.6);
    expect(cool.band().tone).toBe('low');
  });
});
