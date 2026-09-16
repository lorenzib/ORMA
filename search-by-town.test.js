const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
const towns = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/towns.json'), 'utf8'));
const { REACH_KM, namesFor, distanceKm, trailPoints } = require('./scripts/fetch-towns');

describe('searching by the town you are staying in', () => {
  test('the list is towns and cities, never villages', () => {
    // Villages and hamlets would multiply this several times over with names
    // nobody searches for, and every entry is weight in a scannable list.
    expect(towns.towns.length).toBeGreaterThan(50);
    expect([...new Set(towns.towns.map(town => town.place))].sort()).toEqual(['city', 'town']);
  });

  test('every town in it has a walk within reach', () => {
    // A town the search accepts and then reports nothing for is worse than a
    // town it never offered, so the reach filter runs at build time.
    expect(towns.reachKm).toBe(REACH_KM);
    const points = trailPoints();
    expect(points.length).toBeGreaterThan(100);
    const stranded = towns.towns.filter(town =>
      !points.some(([lat, lng]) => distanceKm(town.lat, town.lng, lat, lng) <= REACH_KM));
    expect(stranded.map(town => town.name)).toEqual([]);
  });

  test('a bilingual name is findable by either half', () => {
    // "Klausen - Chiusa" is one place written twice; a visitor knows one of them.
    expect(namesFor({ name:'Klausen - Chiusa', 'name:de':'Klausen', 'name:it':'Chiusa' }))
      .toEqual(['Klausen - Chiusa', 'Klausen', 'Chiusa']);
    const bolzano = towns.towns.find(town => town.name.startsWith('Bolzano'));
    expect(bolzano.names).toEqual(expect.arrayContaining(['Bolzano', 'Bozen']));
  });

  test('a town ranks by distance from it, like a located visitor', () => {
    // Not a filter down to one valley: someone in Bolzano does not know, or
    // care, which valley a walk is in.
    expect(script).toContain("if(liLocationContext.kind === 'current' || liLocationContext.kind === 'town'){");
    expect(script).toContain('const LI_TOWN_RADIUS_KM = 40;');
  });

  test('it reaches further than standing somewhere does', () => {
    // A town is where you are staying, not where you are standing.
    const current = Number(script.match(/const LI_LOCATION_RADIUS_KM = (\d+);/)[1]);
    const town = Number(script.match(/const LI_TOWN_RADIUS_KM = (\d+);/)[1]);
    expect(town).toBeGreaterThan(current);
    expect(town).toBe(REACH_KM);
  });

  test('the name is said back, with how far it looked', () => {
    expect(script).toContain('`${liLocationContext.label} · within ${liLocationContext.radiusKm} km`');
    expect(script).toContain('`near ${liLocationContext.label}`');
  });

  test('a chosen town outlives the tab, a measured position does not', () => {
    // Choosing Bolzano is a decision; being at a coordinate is not.
    expect(script).toMatch(/context\.kind === 'area' \|\| context\.kind === 'town'\).*localStorage\.setItem/s);
    expect(script).toMatch(/context\.kind === 'current'.*sessionStorage\.setItem/s);
  });

  test('the map follows the town', () => {
    expect(script).toContain("(liLocationContext.kind === 'current' || liLocationContext.kind === 'town')");
  });

  test('the list is fetched only when the picker is opened', () => {
    // 19 KB most visits never need: a saved area or "Use my location" skips it.
    const loader = script.slice(script.indexOf('async function liLoadTowns('), script.indexOf('async function liAddTownChoices('));
    expect(loader).toContain("fetch('data/towns.json'");
    expect(script).toMatch(/select\.dataset\.ready = 'true';\s*\n\s*liAddTownChoices\(\);/);
  });

  test('a missing town list narrows the search rather than breaking it', () => {
    const loader = script.slice(script.indexOf('async function liLoadTowns('), script.indexOf('async function liAddTownChoices('));
    expect(loader).toContain('catch(error)');
    expect(loader).toContain('liTowns = [];');
    const adder = script.slice(script.indexOf('async function liAddTownChoices('), script.indexOf('function liPopulateAreaPicker('));
    expect(adder).toContain('if(!towns.length) return;');
  });

  test('the fetch survives Overpass having a bad day', () => {
    // The first run of this script fetched one region and died on a 504.
    const fetcher = fs.readFileSync(path.join(__dirname, 'scripts/fetch-towns.js'), 'utf8');
    expect(fetcher).toContain('response.status === 429 || response.status === 504');
    expect(fetcher).toContain('MAX_ATTEMPTS');
  });

  test('it refuses to write a list it could not filter', () => {
    // Without trail coordinates every town would look reachable.
    const fetcher = fs.readFileSync(path.join(__dirname, 'scripts/fetch-towns.js'), 'utf8');
    expect(fetcher).toContain("throw new Error('No trail coordinates found; refusing to write an unfiltered list')");
  });
});
