const weatherWindow = require('./trail-weather-window');
const scoring = require('./scoring/recommendation-v1.js');
const fixtures = require('./scoring/fixtures-v1.json');
const fs = require('fs');
const path = require('path');

// The engine has always accepted a currentConditions snapshot, and every
// scoring fixture supplies one -- but production called recommendTrail() with
// two arguments, so the score never reflected the day it was being read on.
//
// SCORE-01: conditions are "a separate, timestampable input" that "must carry
// its observation time in the production adapter and must not be described as
// live after it becomes stale". These tests pin that rule and prove the
// snapshot actually changes the number.

const HOUR = 60 * 60 * 1000;

function snapshot(overrides){
  return { status:'known', heatRisk:'high', hotFromLabel:null, capturedAt:Date.now(), ...overrides };
}

describe('a conditions snapshot carries its observation time', () => {
  test('currentConditions stamps capturedAt', () => {
    const before = Date.now();
    const conditions = weatherWindow.currentConditions({ currentTime:'2026-07-15T13:00', temperatureC:30 });
    expect(conditions.status).toBe('known');
    expect(conditions.capturedAt).toBeGreaterThanOrEqual(before);
  });

  test('an explicit capturedAt is preserved', () => {
    const conditions = weatherWindow.currentConditions({ currentTime:'2026-07-15T13:00', temperatureC:30, capturedAt:1000 });
    expect(conditions.capturedAt).toBe(1000);
  });

  test('a snapshot with no temperature is not provided at all', () => {
    expect(weatherWindow.currentConditions({ currentTime:'2026-07-15T13:00' })).toEqual({ status:'not-provided' });
  });
});

describe('a stale snapshot is never handed to the engine as live', () => {
  const now = Date.now();

  test('a fresh snapshot passes through', () => {
    const fresh = snapshot({ capturedAt: now - 60 * 1000 });
    expect(weatherWindow.isFresh(fresh, now)).toBe(true);
    expect(weatherWindow.scoringConditions(fresh, now)).toBe(fresh);
  });

  test('a snapshot older than the shared expiry becomes an explicit omission', () => {
    const stale = snapshot({ capturedAt: now - HOUR });
    expect(weatherWindow.isFresh(stale, now)).toBe(false);
    expect(weatherWindow.scoringConditions(stale, now)).toEqual({ status:'not-provided' });
  });

  test('the expiry matches the pre-hike readiness rule', () => {
    const readiness = fs.readFileSync(path.join(__dirname, 'pre-hike-readiness.js'), 'utf8');
    const declared = readiness.match(/WEATHER_MAX_AGE_MS\s*=\s*([\d\s*]+);/)[1]
      .split("*").map(part => Number(part.trim())).reduce((a, b) => a * b, 1);
    expect(weatherWindow.CONDITIONS_MAX_AGE_MS).toBe(declared);
  });

  test('missing or unknown snapshots are omitted rather than guessed', () => {
    expect(weatherWindow.scoringConditions(undefined, now)).toEqual({ status:'not-provided' });
    expect(weatherWindow.scoringConditions({ status:'not-provided' }, now)).toEqual({ status:'not-provided' });
  });
});

describe('the snapshot actually changes the recommendation', () => {
  const heatCase = fixtures.cases.find(c => c.id === 'heat-sensitive-dog-hot-day');

  function score(currentConditions){
    return scoring.calculateRecommendation({
      dog: heatCase.dog,
      trail: fixtures.trailFixtures[heatCase.trail],
      currentConditions,
    }).score;
  }

  test('high heat costs a heat-sensitive dog real points', () => {
    const withHeat = score({ status:'known', heatRisk:'high' });
    const without = score({ status:'not-provided' });
    expect(withHeat).toBeLessThan(without);
  });

  test('an omitted snapshot says so rather than implying conditions are fine', () => {
    const result = scoring.calculateRecommendation({
      dog: heatCase.dog,
      trail: fixtures.trailFixtures[heatCase.trail],
      currentConditions: { status:'not-provided' },
    });
    const ids = (result.unknowns || []).map(u => u.id || u.code || '');
    expect(ids.join(' ')).toContain('conditions.not-included');
  });

  // The wiring this whole change exists for.
  test('the trail page passes a snapshot into the engine', () => {
    const blueprint = fs.readFileSync(path.join(__dirname, 'trail-blueprint.js'), 'utf8');
    // Assert on the call itself: the helper definition also mentions the name,
    // so a file-wide search would pass even with the argument dropped.
    const call = blueprint.match(/const recommendation = recommendTrail\(([\s\S]*?)\);/);
    expect(call).not.toBeNull();
    expect(call[1]).toContain("conditionsForScoring()");
    expect(blueprint).toContain("addEventListener('dolopaws-conditions-ready', paintPersonalMatch)");
  });
});
