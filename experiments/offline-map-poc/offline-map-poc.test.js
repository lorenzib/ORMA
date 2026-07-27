const fs = require('fs');
const path = require('path');

const root = __dirname;

test('offline package manifest lists existing non-empty resources', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(root, 'packages/carezza-fixture/manifest.json'),
    'utf8',
  ));

  expect(manifest.id).toBe('carezza-fixture');
  expect(manifest.version).toBe(1);
  expect(manifest.required.length).toBeGreaterThan(0);

  manifest.required.forEach(resource => {
    const relative = resource.replace('./packages/carezza-fixture/', '');
    const file = path.join(root, 'packages/carezza-fixture', relative);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).size).toBeGreaterThan(0);
  });
});

test('proof-of-concept worker cannot clear production caches', () => {
  const worker = fs.readFileSync(path.join(root, 'poc-sw.js'), 'utf8');

  expect(worker).toContain("dolopaws-offline-poc-shell-");
  expect(worker).toContain("dolopaws-offline-poc-package-");
  expect(worker).not.toMatch(/keys\.map\(key => caches\.delete\(key\)\)/);
  expect(worker).not.toContain('registration.unregister');
});
