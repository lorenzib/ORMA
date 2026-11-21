'use strict';

// On a cold day a thin-coated dog (a sighthound, a hairless breed) gets the
// same costless "bring a coat" note as a small dog, read from its breed.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const engine = require('./scoring/recommendation-v1.js');
const adapters = require('./scoring/recommendation-adapters-v1.js');
const { loadProductionTrails } = require('./scripts/load-production-trails');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'breeds-data.js'), 'utf8'), context);
const traitsOf = name => vm.runInContext(`breedTraits(${JSON.stringify(name)})`, context);
const insightsOf = name => vm.runInContext(`breedInsights(${JSON.stringify(name)})`, context);

const TRAIL = adapters.normalizeTrail(loadProductionTrails(__dirname).find(trail => trail.id === 'sentiero-del-trenino'));
const weatherWindow = require('./trail-weather-window');
const temps = [0, 1, 2, 3, 3];
const cold = weatherWindow.currentConditions({
  currentTime: '2026-12-10T08:00',
  temperatureC: temps[0],
  hourlyTimes: temps.map((_, index) => `2026-12-10T${String(8 + index).padStart(2, '0')}:00`),
  hourlyTemps: temps,
});
const codes = result => result.cautions.map(entry => entry.code);

describe('thin coats in the cold', () => {
  test('sighthounds and hairless breeds have a thin coat; a husky does not', () => {
    expect(traitsOf('Whippet').thinCoat).toBe(true);
    expect(traitsOf('Chinese Crested Dog').thinCoat).toBe(true);
    expect(traitsOf('Siberian Husky').thinCoat).toBe(false);
    expect(traitsOf('Whippet + Labrador Retriever').thinCoat).toBe(true);
  });

  test('the profile says so', () => {
    expect(insightsOf('Greyhound').map(line => line.title)).toContain('Feels the cold');
    expect(insightsOf('Bernese Mountain Dog').map(line => line.title)).not.toContain('Feels the cold');
  });

  test('a 30 kg greyhound gets the coat note on a cold day, at no cost', () => {
    const dog = { fitness: 'moderate', ageYears: 4, weightKg: 30, traits: { thinCoat: true } };
    const result = engine.calculateRecommendation({ dog, trail: TRAIL, currentConditions: cold });
    const note = result.cautions.find(entry => entry.code === 'conditions.cold.thin-coat');
    expect(note).toBeTruthy();
    expect(note.impact).toBe(0);
    const plain = engine.calculateRecommendation({ dog: { ...dog, traits: {} }, trail: TRAIL, currentConditions: cold });
    expect(plain.score).toBe(result.score);
    expect(codes(plain)).not.toContain('conditions.cold.thin-coat');
  });

  test('a small thin-coated dog gets one note, not two', () => {
    const dog = { fitness: 'moderate', ageYears: 4, weightKg: 3, traits: { thinCoat: true } };
    const result = engine.calculateRecommendation({ dog, trail: TRAIL, currentConditions: cold });
    expect(codes(result).filter(code => code.startsWith('conditions.cold.'))).toEqual(['conditions.cold.thin-coat']);
  });

  test('the saved breed reaches the engine, and both languages have the line', () => {
    const before = global.breedTraits;
    global.breedTraits = traitsOf;
    try {
      expect(adapters.normalizeDog({ breed: 'Whippet', weight: 14 }).traits.thinCoat).toBe(true);
    } finally {
      global.breedTraits = before;
    }
    const i18n = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    expect(i18n.match(/'recommendation\.reason\.conditions\.cold\.thin-coat'/g)).toHaveLength(2);
  });
});
