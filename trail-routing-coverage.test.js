const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    expect(Object.keys(coverage.trails).sort()).toEqual(packaged);
    expect(coverage.maxWalkingRouteM).toBe(5000);
    Object.entries(coverage.trails).forEach(([id, entry]) => {
      expect(entry.graphUrl).toBe(`offline/packages/${id}/footpath-network.json`);
      expect(entry.networkStatus).toBe('mapped');
      expect(entry.nodeCount).toBeGreaterThan(1);
    });
  });
});
