const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const packageDir = path.join(root, 'offline', 'packages', 'alpe-siusi');
const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'manifest.json'), 'utf8'));
const graph = JSON.parse(fs.readFileSync(path.join(packageDir, 'footpath-network.json'), 'utf8'));

function localPathFor(resource){
  return resource.url.startsWith('/')
    ? path.join(root, resource.url)
    : path.join(packageDir, resource.url);
}

describe('Alpe di Siusi offline package', () => {
  test('is a complete, bounded second pilot package', () => {
    expect(manifest.trailId).toBe('alpe-siusi');
    expect(manifest.name).toBe('Alpe di Siusi Meadow Loop');
    expect(manifest.verificationStatus).toBe('field-review-required');
    expect(manifest.resources).toHaveLength(14);
    expect(manifest.packageBytes).toBeLessThanOrEqual(manifest.packageBudgetBytes);
    expect(manifest.bounds).toEqual(graph.bounds);
    expect(manifest.image).toEqual({ width:1200, height:720 });
  });

  test('verifies every required byte before offline use', () => {
    let totalBytes = 0;
    for(const resource of manifest.resources){
      const data = fs.readFileSync(localPathFor(resource));
      expect(resource.required).toBe(true);
      expect(data.byteLength).toBe(resource.bytes);
      expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(resource.sha256);
      totalBytes += data.byteLength;
    }
    expect(totalBytes).toBe(manifest.packageBytes);
  });

  test('contains a valid Alpe routing graph and detailed OSM basemap', () => {
    const map = fs.readFileSync(path.join(packageDir, 'map.svg'), 'utf8');
    expect(graph.trailId).toBe('alpe-siusi');
    expect(graph.nodes.length).toBe(1367);
    expect(graph.edges.length).toBe(1372);
    expect(graph.trailNodes.length).toBe(466);
    expect(map).toContain('Alpe di Siusi Meadow Loop offline trail map');
    expect(map).toContain('viewBox="0 0 1200 720"');
    expect(map).toContain('© OpenStreetMap contributors · ODbL');
    expect(map).toContain('class="route"');
  });

  test('is selectable in both the downloader and offline shell', () => {
    const packages = fs.readFileSync(path.join(root, 'offline-packages.js'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'offline', 'offline-app.js'), 'utf8');
    expect(packages).toContain("'alpe-siusi': {");
    expect(app).toContain("'alpe-siusi': 'packages/alpe-siusi/manifest.json'");
    expect(app).toContain('elements.offlineMap.alt = `Offline route map for ${manifest.name}`');
  });
});
