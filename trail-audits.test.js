const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadTrails() {
  const context = { window: {} };
  vm.createContext(context);
  for (const file of ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js', 'trail-audits.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename: file });
  }
  return vm.runInContext('trails', context);
}

describe('trail presentation audits', () => {
  test('Albanne keeps its dated, sourced route audit and explicit route-number blocker', () => {
    const albanne = loadTrails().find((trail) => trail.id === 'osm-14381570');
    expect(albanne.reviewedAt).toBe('2026-07-26');
    expect(albanne.routeAudit).toEqual(expect.objectContaining({
      photo: expect.any(String),
      route: expect.any(String),
      mapPoints: expect.any(String),
      elevation: expect.any(String),
    }));
    expect(albanne.curated).toBe(true);
    expect(albanne.tier).toBe('route-audited');
    // Les Karellis states the route follows green waymark no. 9 from the
    // tourist office, which is the recommended start, and names no second
    // number. That satisfies the eleventh requirement bc1ed965 introduced.
    expect(albanne.graduation.status).toBe('verified');
    expect(albanne.graduation.required).toHaveLength(11);
    expect(albanne.graduation.completed).toHaveLength(11);
    expect(albanne.graduation.blockers).toEqual({});
    expect(albanne.routeAudit.routeNumbers).toMatch(/balisage vert n\u00B09/);
    expect(albanne.sourceLinks.length).toBeGreaterThanOrEqual(2);
    expect(albanne.path.length).toBeGreaterThan(100);
    expect(albanne.elevation).toBe(249);
    expect(albanne.elevationProfile[0].km).toBe(0);
    expect(albanne.elevationProfile.at(-1).km).toBe(albanne.distance);
  });

  test('every Albanne water point retains its source GPS location', () => {
    const albanne = loadTrails().find((trail) => trail.id === 'osm-14381570');
    expect(albanne.waterSources.length).toBeGreaterThan(0);
    albanne.waterSources.forEach((point) => {
      expect(Number.isFinite(point.lat)).toBe(true);
      expect(Number.isFinite(point.lng)).toBe(true);
      expect(point.osmId).toMatch(/^node\//);
    });
  });

  test.each([
    // Laugen Elvas is documented by name only with no numbered waymark, which
    // is the named-only alternative the requirement allows. Anello del Sole
    // stays open: its municipal listing shows "5 - Anello del Sole" and no
    // official source settles whether that 5 is a waymark or a list index.
    ['osm-12731853', 4.2, 100, ['access']],
    ['osm-7548344', 3, 250, ['routeNumbers', 'livestock', 'access']],
  ])('%s records official figures and precise remaining blockers', (id, distance, elevation, blockers) => {
    const trail = loadTrails().find((candidate) => candidate.id === id);
    expect(trail.curated).toBe(false);
    expect(trail.reviewedAt).toBe('2026-07-26');
    expect(trail.reviewedBy).toBe('ORMA route audit');
    expect(trail.distance).toBe(distance);
    expect(trail.elevation).toBe(elevation);
    expect(trail.elevationProfile[0].km).toBe(0);
    expect(trail.elevationProfile.at(-1).km).toBe(distance);
    expect(trail.graduation.status).toBe('in-progress');
    expect(Object.keys(trail.graduation.blockers)).toEqual(blockers);
    expect(trail.desc).not.toMatch(/imported from the OpenStreetMap/i);
    expect(trail.tips).not.toMatch(/^Imported route/i);
    expect(trail.sourceLinks.length).toBeGreaterThanOrEqual(4);
  });

  test('Laugen–Elvas water points retain exact source coordinates', () => {
    const trail = loadTrails().find((candidate) => candidate.id === 'osm-12731853');
    expect(trail.waterSources).toHaveLength(2);
    trail.waterSources.forEach((point) => {
      expect(Number.isFinite(point.lat)).toBe(true);
      expect(Number.isFinite(point.lng)).toBe(true);
      expect(point.osmId).toMatch(/^node\//);
    });
  });

  test('map waypoints are never guessed from rounded kilometre values', () => {
    const detailScript = fs.readFileSync(path.join(__dirname, 'trail.js'), 'utf8');
    expect(detailScript).toContain("typeof waypoint.lat !== 'number'");
    expect(detailScript).toContain('.setLngLat([waypoint.lng, waypoint.lat])');
    expect(detailScript).not.toContain("addWaypoint(r.km, 'hut'");
    expect(detailScript).not.toContain("addWaypoint(w.km, 'water'");
  });
});
