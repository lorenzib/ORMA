const fs = require('fs');
const path = require('path');

const root = __dirname;
const expected = ['alpe-siusi', 'lago-carezza'];

function objectKeysFrom(source, declaration){
  const match = source.match(new RegExp(`const ${declaration} = \\{([\\s\\S]*?)\\n  \\};`));
  if(!match) throw new Error(`Could not find ${declaration}`);
  return [...match[1].matchAll(/^\s{4}'([^']+)':/gm)].map(item => item[1]).sort();
}

describe('controlled offline beta scope', () => {
  test('only the two chartered routes are registered for download', () => {
    const source = fs.readFileSync(path.join(root, 'offline-packages.js'), 'utf8');
    expect(objectKeysFrom(source, 'PACKAGES')).toEqual(expected);
  });

  test('only the two chartered packages exist in the production package directory', () => {
    const packageIds = fs.readdirSync(path.join(root, 'offline', 'packages'), { withFileTypes:true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
    expect(packageIds).toEqual(expected);
  });

  test('both package manifests still require a dated field review', () => {
    for(const trailId of expected){
      const manifest = JSON.parse(fs.readFileSync(
        path.join(root, 'offline', 'packages', trailId, 'manifest.json'),
        'utf8'
      ));
      expect(manifest.trailId).toBe(trailId);
      expect(manifest.verificationStatus).toBe('field-review-required');
    }
  });
});
