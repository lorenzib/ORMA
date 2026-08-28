const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const { buildCanonicalCatalog } = require('./scripts/trail-adapter');

const root = __dirname;

describe('trail walking-route coverage', () => {
  test('publishes every valid packaged graph without a hardcoded UI allowlist', () => {
    const context = { window:{} };
    vm.createContext(context);
    vm.runInContext(
      fs.readFileSync(path.join(root, 'trail-routing-coverage.js'), 'utf8'),
      context
    );
    const coverage = context.window.DoloPawsTrailRoutingCoverage;
    const packaged = fs.readdirSync(path.join(root, 'offline', 'packages'), { withFileTypes:true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(id => fs.existsSync(path.join(root, 'offline', 'packages', id, 'footpath-network.json')))
      .sort();
    const online = fs.existsSync(path.join(root, 'routing-graphs'))
      ? fs.readdirSync(path.join(root, 'routing-graphs'))
        .filter(file => /^[a-z0-9-]+\.json$/.test(file))
        .map(file => file.replace(/\.json$/, ''))
      : [];
    const expected = [...new Set([...packaged, ...online])].sort();
    expect(Object.keys(coverage.trails).sort()).toEqual(expected);
    const publishedIds = new Set(
      buildCanonicalCatalog(loadProductionTrails(root)).records
        .filter(record => record.lifecycle === 'published')
        .map(record => record.id)
    );
    expect(expected.every(id => publishedIds.has(id))).toBe(true);
    expect(coverage.maxWalkingRouteM).toBe(5000);
    Object.entries(coverage.trails).forEach(([id, entry]) => {
      expect(entry.graphUrl).toBe(packaged.includes(id)
        ? `offline/packages/${id}/footpath-network.json`
        : `routing-graphs/${id}.json`);
      expect(entry.networkStatus).toBe('mapped');
      expect(entry.nodeCount).toBeGreaterThan(1);
    });
  });

  test('covers every published Val di Funes–Odle route with a five-kilometre graph', () => {
    const context = { window:{} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'trail-routing-coverage.js'), 'utf8'), context);
    const coverage = context.window.DoloPawsTrailRoutingCoverage;
    const ids = [
      'santa-maddalena', 'valley-view', 'osm-11774783',
      'osm-11780502', 'osm-12142337', 'osm-13491868',
    ];
    ids.forEach(id => {
      const entry = coverage.trails[id];
      expect(entry).toBeDefined();
      const graph = JSON.parse(fs.readFileSync(path.join(root, entry.graphUrl), 'utf8'));
      expect(graph.trailId).toBe(id);
      expect(graph.restrictions.maxApproachM).toBe(5000);
      expect(graph.trailNodes.length).toBeGreaterThan(0);
      expect(graph.attribution).toContain('OpenStreetMap');
    });
  });
});
