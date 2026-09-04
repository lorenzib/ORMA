const readiness = require('./pre-hike-readiness');
const fs = require('fs');
const path = require('path');
const { expectBundledBefore, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');

const NOW = Date.UTC(2026, 6, 30, 10, 0, 0);

function readyInput(){
  return {
    online:true,
    package:{
      supported:true,
      usable:true,
      state:'ready',
      requiredChecked:9,
      contentFreshness:'current',
    },
    selfTest:{ passed:true, checkedAt:NOW - 1000 },
    gps:{
      supported:true,
      permission:'granted',
      fix:{ usableForProgress:true, accuracyM:18 },
    },
    weather:{ status:'ready', capturedAt:NOW - 1000, temperatureC:17 },
    trailhead:{ available:true, label:'Main car park', lat:46.4, lng:11.5 },
  };
}

describe('UX-06 pre-hike readiness model', () => {
  test('allows starting only when blocking GPS checks pass', () => {
    const result = readiness.assess(readyInput(), NOW);
    expect(result.canStart).toBe(true);
    expect(result.counts.blocker).toBe(0);
    expect(result.items.find(entry => entry.id === 'gps').level).toBe('ready');
  });

  test.each([
    [{ supported:false, permission:'prompt', fix:null }, 'GPS is unavailable'],
    [{ supported:true, permission:'denied', fix:null }, 'Location permission is blocked'],
    [{ supported:true, permission:'prompt', fix:null }, 'GPS fix not checked'],
    [{ supported:true, permission:'granted', fix:{ usableForProgress:false, accuracyM:180 } }, 'GPS fix is not usable yet'],
  ])('blocks unsafe GPS state %#', (gps, title) => {
    const input = readyInput();
    input.gps = gps;
    const result = readiness.assess(input, NOW);
    expect(result.canStart).toBe(false);
    expect(result.items.find(entry => entry.id === 'gps').title).toBe(title);
  });

  test('keeps missing offline coverage advisory while showing its state', () => {
    const input = readyInput();
    input.package = { supported:false, usable:false };
    input.selfTest = { passed:false };
    const result = readiness.assess(input, NOW);
    expect(result.canStart).toBe(true);
    expect(result.items.find(entry => entry.id === 'package').level).toBe('advisory');
    expect(result.items.find(entry => entry.id === 'self-test').level).toBe('advisory');
  });

  test('blocks a broken package only when the device is already offline', () => {
    const input = readyInput();
    input.online = false;
    input.package = { supported:true, usable:false, state:'failed' };
    expect(readiness.assess(input, NOW).items.find(entry => entry.id === 'package').level)
      .toBe('blocker');
    input.online = true;
    expect(readiness.assess(input, NOW).items.find(entry => entry.id === 'package').level)
      .toBe('advisory');
  });

  test('distinguishes stale information and weather without hiding the route', () => {
    const input = readyInput();
    input.package.contentFreshness = 'stale';
    input.weather.capturedAt = NOW - readiness.WEATHER_MAX_AGE_MS - 1;
    const result = readiness.assess(input, NOW);
    expect(result.items.find(entry => entry.id === 'freshness').level).toBe('advisory');
    expect(result.items.find(entry => entry.id === 'weather').level).toBe('advisory');
    expect(result.canStart).toBe(true);
  });

  test('requires a recent self-test and always exposes emergency preparation', () => {
    const input = readyInput();
    input.selfTest.checkedAt = NOW - readiness.SELF_TEST_MAX_AGE_MS - 1;
    const result = readiness.assess(input, NOW);
    expect(result.items.find(entry => entry.id === 'self-test').level).toBe('advisory');
    expect(result.items.find(entry => entry.id === 'emergency')).toEqual(
      expect.objectContaining({ level:'ready', action:'safety-guide' })
    );
  });

  test('translates every assessed state at render time and interpolates values', () => {
    const translated = {
      'readiness.package.verified.title':'Mappa offline verificata',
      'readiness.package.verified.files':'Verificati {count} file necessari.',
      'readiness.gps.usable.title':'Posizione GPS utilizzabile',
      'readiness.gps.usable.detail':'Precisione circa ±{accuracy} m.',
    };
    const t = (key, vars) => {
      let value = translated[key] || key;
      for(const name of Object.keys(vars || {})){
        value = value.split(`{${name}}`).join(vars[name]);
      }
      return value;
    };
    const result = readiness.assess(readyInput(), NOW, t);

    expect(result.items.find(entry => entry.id === 'package')).toEqual(
      expect.objectContaining({
        title:'Mappa offline verificata',
        detail:'Verificati 9 file necessari.',
      })
    );
    expect(result.items.find(entry => entry.id === 'gps')).toEqual(
      expect.objectContaining({
        title:'Posizione GPS utilizzabile',
        detail:'Precisione circa ±18 m.',
      })
    );
  });

  test('uses a real trailhead coordinate rather than invented fallback data', () => {
    expect(readiness.trailheadFor({
      startPoint:{ lat:46.41, lng:11.57, label:'Carezza car park' },
    })).toEqual({
      available:true,
      lat:46.41,
      lng:11.57,
      label:'Carezza car park',
    });
    expect(readiness.trailheadFor({ area:'Unknown' }).available).toBe(false);
  });

  test('the trail page wires readiness before hike mode and publishes weather state', () => {
    const page = fs.readFileSync(path.join(__dirname, 'trail.html'), 'utf8');
    const hikeMode = fs.readFileSync(path.join(__dirname, 'hike-mode.js'), 'utf8');
    const blueprint = fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8');
    expect(page).toContain('pre-hike-readiness.css');
    expectTrailBundleLoaded();
    expectBundledBefore('pre-hike-readiness.js', 'hike-mode.js');
    expect(hikeMode).toContain('window.DoloPawsReadiness.open(trail, startHike)');
    expect(blueprint).toContain("new CustomEvent('dolopaws-weather-ready'");
  });

  test('the UI states the emergency-navigation boundary explicitly', () => {
    const source = fs.readFileSync(path.join(__dirname, 'pre-hike-readiness.js'), 'utf8');
    expect(source).toContain('not an emergency-navigation service');
    expect(source).toContain('do not replace waymarks');
    expect(source).toContain("assess(state, undefined, win.t)");
  });
});
