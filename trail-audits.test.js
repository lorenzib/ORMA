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

  test('Laugen Elvas graduates on the biotope rule, not on an assumption about dogs', () => {
    // Its last open check was access. The Natz-Schabs landscape plan protects
    // Biotop 12/1 Laugen and forbids leaving the marked paths, disturbing wild
    // animals and bathing; it neither bans dogs nor sets a leash rule. The
    // page has to say exactly that, and cite where it comes from.
    const trail = loadTrails().find((candidate) => candidate.id === 'osm-12731853');
    expect(trail.curated).toBe(true);
    expect(trail.tier).toBe('route-audited');
    expect(trail.graduation.status).toBe('verified');
    expect(trail.graduation.completed).toEqual(trail.graduation.required);
    expect(trail.tips).toMatch(/marked path/);
    expect(trail.graduation.blockers).toEqual({});
    expect(trail.verified.categories).toContain('access');
    expect(trail.verified.sources.some((source) => /Natz-Schabs/.test(source))).toBe(true);
    expect(trail.sourceLinks.some((link) => /newplan\.civis\.bz\.it/.test(link.url))).toBe(true);
    expect(trail.dogNotes).toMatch(/not banned/);
    expect(trail.dogNotes).toMatch(/marked paths/);
    expect(trail.dogNotes).not.toMatch(/not yet confirmed/);
  });

  test('Anello del Sole graduates on the waymark sheet and both municipal leash rules', () => {
    // routeNumbers: the CAI Lozzo sheet defines sv. as the waymark and lists
    // the loop as sv. 5. access: the loop crosses Lozzo and Domegge di Cadore,
    // and both regulations require a leash. livestock: no pasture described or
    // mapped along the line, with two farm buildings beside it.
    const trail = loadTrails().find((candidate) => candidate.id === 'osm-7548344');
    expect(trail.curated).toBe(true);
    expect(trail.tier).toBe('route-audited');
    expect(trail.distance).toBe(3);
    expect(trail.elevation).toBe(250);
    expect(trail.graduation.status).toBe('verified');
    expect(trail.graduation.completed).toEqual(trail.graduation.required);
    expect(trail.graduation.blockers).toEqual({});
    expect(trail.routeAudit.routeNumbers).toMatch(/sv\. 5/);
    expect(trail.verified.categories).toEqual(expect.arrayContaining(['livestock', 'access']));
    expect(trail.verified.sources.filter((source) => /Regolamento di Polizia Urbana/.test(source))).toHaveLength(2);
    expect(trail.tips).toMatch(/leash/);
    expect(trail.tips).toMatch(/Domegge/);
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
