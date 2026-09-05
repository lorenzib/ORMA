const fs = require('fs');
const path = require('path');
const scoring = require('./scoring/recommendation-v1.js');

function read(file){
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

// The advisory that hike mode consumes, produced by the canonical engine.
function advisoriesFor(segments){
  return scoring.calculateRecommendation({
    dog:{ fitness:'moderate' },
    trail:{
      metrics:{ distanceKm:7.4 },
      suitability:{ dogAccess:{ status:'allowed' } },
      waypoints:[],
      segments,
      verification:{ categories:{} },
    },
  }).leashAdvisories;
}

const pasture = [{
  id:'upper-pasture', type:'livestock', fromKm:2.1, toKm:3.4,
  advisory:'leash-recommended', note:'open grazing pasture', status:'reviewed',
}];

// Mirrors the window in hike-mode.js: warn 300 m out, hold while inside.
const LEAD_WARNING_KM = 0.3;
function stateAt(zones, km){
  for(const zone of zones){
    if(km >= zone.fromKm && km <= zone.toKm) return { state:'inside', zone };
  }
  for(const zone of zones){
    const ahead = zone.fromKm - km;
    if(ahead > 0 && ahead <= LEAD_WARNING_KM) return { state:'approaching', zone, ahead };
  }
  return { state:'silent' };
}

describe('HIKE lead-on advisories', () => {
  test('hike mode reads the canonical advisories instead of re-deriving them', () => {
    const hikeMode = read('hike-mode.js');

    // The rules for which segments are usable belong to the scorer. Hike mode
    // must not grow a second copy of them.
    expect(hikeMode).toContain('recommendTrail');
    expect(hikeMode).toContain('leashAdvisories');
    expect(hikeMode).not.toContain("advisory === 'leash-recommended'");
    expect(hikeMode).not.toContain('SEGMENT_SHOWN_STATUSES');
  });

  test('warns before the stretch, holds inside it, and goes quiet after', () => {
    const zones = advisoriesFor(pasture);
    expect(zones).toHaveLength(1);

    expect(stateAt(zones, 1.5).state).toBe('silent');
    expect(stateAt(zones, 1.9)).toEqual(expect.objectContaining({ state:'approaching' }));
    expect(Math.round(stateAt(zones, 1.9).ahead * 1000)).toBe(200);
    expect(stateAt(zones, 2.5).state).toBe('inside');
    expect(stateAt(zones, 3.4).state).toBe('inside');
    expect(stateAt(zones, 3.6).state).toBe('silent');
  });

  test('an unconfirmed report never produces an alert', () => {
    // Same rule as the trail page: a community sighting waits for confirmation
    // rather than speaking up mid-walk.
    expect(advisoriesFor([{ ...pasture[0], status:'reported' }])).toEqual([]);
  });

  test('a trail with no segments is silent rather than noisy', () => {
    expect(advisoriesFor([])).toEqual([]);
  });

  test('both languages can render the alert', () => {
    const i18n = read('i18n.js');
    const keys = (i18n.match(/'hike\.leadOn(Ahead|Now)':/g) || []).length;

    // Two keys, English and Italian.
    expect(keys).toBe(4);
    expect(i18n).toContain("'hike.leadOnNow': '🦮 lead on now: {what}'");
    expect(i18n).toContain("'hike.leadOnNow': '🦮 metti il guinzaglio: {what}'");
  });
});
