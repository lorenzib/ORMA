'use strict';

// "Fit for your dog" on Draw a route (route-fit.js): the record the engine
// scores for a freshly drawn line, the draft's own verdict words, the card's
// rows and mapped water near the line.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The engine and the helpers as the planner page loads them.
const page = { console };
page.window = page;
page.globalThis = page;
vm.createContext(page);
['breeds-data.js', 'trust/evidence-v1.js', 'scoring/recommendation-v1.js',
  'scoring/recommendation-adapters-v1.js', 'route-return.js', 'scoring.js',
  'match-verdict.js', 'recommendation-decision.js', 'route-adjust.js', 'route-fit.js',
].forEach(file => vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), page));
const fit = page.ORMARouteFit;

// A 3.6 km loop near Lüsen, 36 points about 100 m apart, rising 160 m and
// coming back down. `pitch` sets how much of the climb is squeezed into one
// stretch, to make it steeper.
function loop({ km = 3.6, climb = 160, steep = false } = {}){
  const count = Math.round(km * 10);
  const centre = { lat:46.745, lng:11.763 };
  const radiusM = km * 1000 / (2 * Math.PI);
  const pathPoints = [];
  const heights = [];
  for(let i = 0; i <= count; i++){
    const angle = 2 * Math.PI * i / count;
    pathPoints.push({
      lat:centre.lat + radiusM * Math.sin(angle) / 111320,
      lng:centre.lng + radiusM * Math.cos(angle) / (111320 * Math.cos(centre.lat * Math.PI / 180)),
    });
    const half = i / count < 0.5 ? i / count * 2 : (1 - i / count) * 2;
    // Steep: the whole climb in the first fifth of the way up.
    const share = steep ? Math.min(1, half * 2.5) : half;
    heights.push(1000 + climb * share);
  }
  return { path:pathPoints, distanceM:km * 1000, ascentM:climb, heights, shape:'loop' };
}

const healthy = { name:'Luna', fitness:'moderate', ageBand:'5-6', weightBand:'15-20' };
const senior = { name:'Nonno', fitness:'low', ageBand:'13plus', weightBand:'30-40', conditions:['joints'] };
const subjectFor = dog => vm.runInContext(`effectiveOverrides(${JSON.stringify(dog)}, null)`, page);

function rate(route, dog){
  const record = fit.draftRecord(route, route.shape);
  const rec = fit.recommend(record, subjectFor(dog));
  const presented = page.DoloPawsRecommendationDecision.present(rec, { dogName:dog.name });
  return { record, rec, verdict:fit.verdictOf(rec), presented };
}

describe('the record a drawn line is scored on', () => {
  test('distance and climb are the router’s, steepness comes from its heights', () => {
    const record = fit.draftRecord(loop(), 'loop');
    expect(record.distance).toBe(3.6);
    expect(record.elevation).toBe(160);
    expect(record.descent).toBe(160);
    expect(record.elevationProfile.length).toBeGreaterThan(3);
    expect(record.hours).toBeGreaterThan(0.5);
    expect(record.curated).toBe(false);
  });

  test('without heights, steepness is unknown rather than guessed', () => {
    const route = { ...loop(), heights:null };
    const record = fit.draftRecord(route, 'loop');
    expect(record.terrainRank).toBeNull();
    expect(record.elevationProfile).toBeUndefined();
  });

  test('nothing the line cannot tell is filled in', () => {
    const record = fit.draftRecord(loop(), 'loop');
    ['exposure', 'heatRisk', 'shadeCoverage', 'surfaceHazards', 'waterSources', 'liftAccess'].forEach(field => {
      expect(record[field]).toBeUndefined();
    });
  });

  test('a one-way line is scored as drawn, not turned into a there-and-back', () => {
    const route = { ...loop(), shape:'point-to-point' };
    const { rec } = rate(route, healthy);
    const distance = rec.positiveReasons.concat(rec.cautions).find(item => item.code.startsWith('trail.distance.'));
    expect(distance.vars.distance).toBe(3.6);
  });

  test('under 1 km is not rated', () => {
    expect(fit.rateable({ ...loop(), distanceM:600 })).toBe(false);
    expect(fit.draftRecord({ ...loop(), distanceM:600 }, 'loop')).toBeNull();
    expect(fit.rateable(loop())).toBe(true);
  });
});

describe('the draft’s verdict', () => {
  test('a short gentle loop is within a healthy dog’s range', () => {
    expect(rate(loop(), healthy).verdict).toBe('within');
  });

  test('the engine’s cap for an unchecked route does not make it a stretch', () => {
    const { rec, verdict } = rate(loop(), healthy);
    expect(rec.category).not.toBe('strong-option');
    expect(verdict).toBe('within');
  });

  test('the same loop is a stretch or beyond for an old dog with sore joints', () => {
    expect(['stretch', 'beyond']).toContain(rate(loop({ steep:true }), senior).verdict);
  });

  test('a long climb is beyond a low-fitness senior', () => {
    expect(rate(loop({ km:16, climb:900 }), senior).verdict).toBe('beyond');
  });
});

describe('the card’s rows', () => {
  test('a healthy dog: distance and climb fit, steepness and time said as facts, no evidence row', () => {
    const { record, presented } = rate(loop(), healthy);
    const rows = fit.cardRows({ record, presented, name:'Luna' });
    const topics = rows.map(row => row.topic);
    expect(topics).toEqual(expect.arrayContaining(['Distance', 'Climb', 'Steepness', 'Walking time']));
    expect(rows.some(row => String(row.code).startsWith('evidence.'))).toBe(false);
    expect(rows.find(row => row.topic === 'Steepness').detail).toMatch(/^(Gentle|Moderately steep|Steep)/);
  });

  test('what lowers the fit comes first', () => {
    const { record, presented } = rate(loop({ steep:true }), senior);
    const rows = fit.cardRows({ record, presented, name:'Nonno' });
    expect(rows[0].tone).toBe('cost');
    expect(rows[0].detail).toContain('Nonno');
  });

  test('mapped water is said as mapped, and nothing is said outside the water map', () => {
    const { record, presented } = rate(loop(), healthy);
    const one = fit.cardRows({ record, presented, name:'Luna', water:{ covered:true, count:1 } });
    expect(one.find(row => row.topic === 'Water').detail).toMatch(/may be dry/);
    const none = fit.cardRows({ record, presented, name:'Luna', water:{ covered:true, count:0 } });
    expect(none.find(row => row.topic === 'Water').detail).toContain('Carry enough for Luna');
    const outside = fit.cardRows({ record, presented, name:'Luna', water:{ covered:false, count:0 } });
    expect(outside.some(row => row.topic === 'Water')).toBe(false);
  });
});

describe('mapped water near the line', () => {
  const route = loop();
  const at = (lat, lng) => ({ type:'Feature', geometry:{ type:'Point', coordinates:[lng, lat] } });
  const onLine = route.path[5];
  const far = { lat:46.70, lng:11.70 };
  const farOther = { lat:46.80, lng:11.85 };

  test('counts points within reach of the line only', () => {
    const result = fit.waterNear(route.path, [at(onLine.lat, onLine.lng), at(far.lat, far.lng), at(farOther.lat, farOther.lng)]);
    expect(result).toEqual({ covered:true, count:1 });
  });

  test('a line outside the water map is not covered', () => {
    const result = fit.waterNear(route.path, [at(45.0, 7.0), at(45.1, 7.1)]);
    expect(result.covered).toBe(false);
    expect(result.count).toBe(0);
  });
});

describe('the page', () => {
  const html = fs.readFileSync(path.join(__dirname, 'route-planner.html'), 'utf8');
  test('loads route-fit.js before the planner, and has the card', () => {
    expect(html.indexOf('route-fit.js')).toBeGreaterThan(-1);
    expect(html.indexOf('route-fit.js')).toBeLessThan(html.indexOf('route-planner.js'));
    expect(html).toContain('id="plannerFit"');
  });

  test('the draft never borrows the seal’s words', () => {
    const script = fs.readFileSync(path.join(__dirname, 'route-planner.js'), 'utf8');
    const card = script.slice(script.indexOf('// ---- Fit for your dog'));
    expect(card).not.toMatch(/Strong option|Verified/);
    expect(card).toContain('Not an ORMA check');
  });
});
