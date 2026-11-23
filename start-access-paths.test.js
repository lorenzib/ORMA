const fs = require('fs');
const path = require('path');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const {
  DATA_FILE, THRESHOLD_M, MAX_LENGTH_M, START_MATCH_M, nearestOnLine, lineLength, startGapM, metres,
} = require('./scripts/start-access-paths');
const { renderOfflineMap } = require('./scripts/render-offline-osm-map');

const root = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(root, DATA_FILE), 'utf8'));
const trails = loadProductionTrails(root)
  .filter(trail => trail.startPoint && Array.isArray(trail.path) && trail.path.length > 1);
const point = ([lat, lng]) => ({ lat, lng });

describe('the walk-in from a start flag that sits off the line', () => {
  test(`every start more than ${THRESHOLD_M} m from its line has a walk-in or a reviewed reason`, () => {
    const missing = trails
      .filter(trail => startGapM(trail) > THRESHOLD_M)
      .filter(trail => !trail.accessPath && !(data.exceptions[trail.id] && data.exceptions[trail.id].reason))
      .map(trail => `${trail.id} (${Math.round(startGapM(trail))} m)`);
    // Route one with: node scripts/build-start-access-paths.js --trail=<id>
    expect(missing).toEqual([]);
  });

  test('each walk-in leaves the start flag, meets the line and stays under the cap', () => {
    const byId = new Map(trails.map(trail => [trail.id, trail]));
    Object.entries(data.paths).forEach(([id, record]) => {
      const trail = byId.get(id);
      expect({ id, published:Boolean(trail) }).toEqual({ id, published:true });
      expect({ id, applied:Boolean(trail.accessPath) }).toEqual({ id, applied:true });
      const line = record.path;
      expect(metres(point(line[0]), trail.startPoint)).toBeLessThanOrEqual(START_MATCH_M);
      expect(nearestOnLine(point(line[line.length - 1]), trail.path).distanceM).toBeLessThan(2);
      const overCap = (data.overCap || {})[id];
      expect(record.lengthM).toBeLessThanOrEqual(overCap ? overCap.maxLengthM : MAX_LENGTH_M);
      expect(Math.abs(lineLength(line) - record.lengthM)).toBeLessThanOrEqual(2);
    });
  });

  test('a start label that gives a distance to the walk agrees with the walk-in', () => {
    const disagree = trails.filter(trail => trail.accessPath).map(trail => {
      const said = /([\d,]+) m (?:on foot )?from the (?:loop|route|walk)/.exec(trail.startPoint.label || '');
      if(!said) return null;
      const statedM = Number(said[1].replace(/,/g, ''));
      return Math.abs(statedM - trail.accessPath.lengthM) > Math.max(30, trail.accessPath.lengthM * 0.25)
        ? `${trail.id}: label ${statedM} m, walk-in ${trail.accessPath.lengthM} m` : null;
    }).filter(Boolean);
    expect(disagree).toEqual([]);
  });

  test('a walk-in over the cap is the owner’s call and is named under Where to start', () => {
    Object.entries(data.overCap || {}).forEach(([id, entry]) => {
      expect(entry.decision).toMatch(/Owner/);
      const record = data.paths[id];
      expect({ id, drawn:Boolean(record) }).toEqual({ id, drawn:true });
      if(entry.startLine){
        expect(Number.isFinite(record.climbM)).toBe(true);
        const trail = trails.find(item => item.id === id);
        expect(trail.accessPath).toMatchObject({ startLine:true, climbM:record.climbM });
      }
    });
    const line = 'From the start it’s about {distance} on foot and {climb} m up to the walk. This is not included in the walk’s figures.';
    expect(fs.readFileSync(path.join(root, 'trail-blueprint.js'), 'utf8')).toContain(line);
    expect(fs.readFileSync(path.join(root, 'scripts', 'generate-trail-pages.js'), 'utf8')).toContain(line);
    expect(fs.readFileSync(path.join(root, 'i18n-phrases-it.js'), 'utf8')).toContain(JSON.stringify(line));
  });

  test('the walk-in never changes the walk’s own figures', () => {
    const withAccess = trails.filter(trail => trail.accessPath);
    expect(withAccess.length).toBeGreaterThan(0);
    withAccess.forEach(trail => {
      expect(trail.path).not.toContainEqual(trail.accessPath.path[1]);
    });
  });

  test('an exception is only kept while the start is still off the line and undrawn', () => {
    const byId = new Map(trails.map(trail => [trail.id, trail]));
    const stale = Object.keys(data.exceptions).filter(id => {
      const trail = byId.get(id);
      return !trail || trail.accessPath || startGapM(trail) <= THRESHOLD_M;
    });
    expect(stale).toEqual([]);
  });

  test('the trail page and the homepage preview draw it solid grey under the walk; the offline map draws it too', () => {
    // Owner, 20 Nov 2026: no dotted or dashed lines on the maps. The walk-in
    // is solid dark grey on a white edge, so the walk stays the only
    // coloured line. (The offline SVG map keeps its own drawing for now.)
    const style = fs.readFileSync(path.join(root, 'map-style.js'), 'utf8');
    expect(style).toContain("const ACCESS_LINE_COLOUR = '#4D554E';");
    const accessPaint = style.slice(style.indexOf('function accessLinePaint'), style.indexOf('function addAccessLine'));
    expect(accessPaint).not.toContain('line-dasharray');
    const page = fs.readFileSync(path.join(root, 'trail.js'), 'utf8');
    expect(page).toContain("beforeId: 'single-trail-path-line-casing'");
    expect(page).toContain('Not part of the walk’s distance.');
    const home = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
    expect(home).toContain("beforeId:'trail-selected-route-casing'");
    const italian = fs.readFileSync(path.join(root, 'i18n-phrases-it.js'), 'utf8');
    expect(italian).toContain('"Grey line: about {distance} on foot from the start flag to the walk. Not part of the walk’s distance."');

    const route = {
      type:'FeatureCollection',
      features:[
        { type:'Feature', properties:{ name:'Test walk' }, geometry:{ type:'LineString', coordinates:[[11.0, 46.0], [11.01, 46.0]] } },
        { type:'Feature', properties:{ kind:'access', lengthM:184 }, geometry:{ type:'LineString', coordinates:[[11.0, 45.9985], [11.0, 46.0]] } },
      ],
    };
    const xml = '<osm><bounds minlat="45.99" minlon="10.99" maxlat="46.01" maxlon="11.02"/></osm>';
    const { svg } = renderOfflineMap({ trailId:'test-walk', xml, route, height:600 });
    expect(svg.indexOf('class="access"')).toBeGreaterThan(-1);
    expect(svg.indexOf('class="access"')).toBeLessThan(svg.indexOf('class="route"'));
    expect(svg).toContain('~180 m');
    const long = JSON.parse(JSON.stringify(route));
    long.features[1].properties.lengthM = 2124;
    expect(renderOfflineMap({ trailId:'test-walk', xml, route:long, height:600 }).svg).toContain('~2.1 km');
  });
});
