const path = require('path');
const { loadProductionTrails } = require('./scripts/load-production-trails');
const {
  adaptLegacyTrail,
  buildCanonicalCatalog,
  legacyInputErrors,
  validateCatalog,
} = require('./scripts/trail-adapter');

const root = path.resolve(__dirname);

describe('DATA-02 production trail validation', () => {
  const sourceTrails = loadProductionTrails(root);
  const catalog = buildCanonicalCatalog(sourceTrails);

  test('every production source record becomes one canonical record', () => {
    expect(sourceTrails.length).toBeGreaterThan(0);
    expect(catalog.records).toHaveLength(sourceTrails.length);
  });

  test('the complete canonical catalog passes the shared schema', () => {
    expect(catalog.errors).toEqual([]);
  });

  test('canonical IDs and generated slugs are unique', () => {
    expect(new Set(catalog.records.map(record => record.id)).size).toBe(catalog.records.length);
    expect(new Set(catalog.records.map(record => record.slug)).size).toBe(catalog.records.length);
  });

  test('legacy latitude-longitude paths are converted to GeoJSON order', () => {
    const source = sourceTrails.find(trail => trail.id === 'lago-carezza');
    const canonical = catalog.records.find(trail => trail.id === 'lago-carezza');
    expect(canonical.geometry.coordinates[0]).toEqual([
      source.path[0][1],
      source.path[0][0],
    ]);
  });

  test('unknown legacy values are explicit and declared', () => {
    const imported = catalog.records.find(record => record.origin === 'osm'
      && record.suitability.exposure === null);
    expect(imported.unknownFields).toContain('/suitability/exposure');
    expect(imported.suitability.dogAccess.status).toBe('unknown');
    expect(imported.unknownFields).toContain('/suitability/dogAccess/status');
  });

  test('broken or unrealistic routes are held as drafts with field-level reasons', () => {
    const broken = catalog.excluded.find(entry => entry.id === 'osm-1780768');
    expect(broken.reasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/geometry jump 6\.\d+ km before point/),
      expect.stringMatching(/distance 77\.4 km exceeds/),
    ]));
    expect(catalog.records.find(record => record.id === broken.id).lifecycle).toBe('draft');
  });

  test('an invalid source coordinate fails with record and field', () => {
    const invalid = {
      ...sourceTrails[0],
      id: 'invalid-coordinate',
      path: [[95, 11.5], [46.5, 11.6]],
      lat: 95,
    };
    const { record } = adaptLegacyTrail(invalid, { slug: 'invalid-coordinate' });
    expect(validateCatalog([record])).toEqual(expect.arrayContaining([
      expect.stringMatching(/^invalid-coordinate\/geometry\/coordinates\/0\/1: invalid latitude$/),
      expect.stringMatching(/^invalid-coordinate\/center\/1: invalid latitude$/),
    ]));
  });

  test('duplicate IDs and slugs fail clearly', () => {
    const first = catalog.records[0];
    const duplicate = JSON.parse(JSON.stringify(first));
    expect(validateCatalog([first, duplicate])).toEqual(expect.arrayContaining([
      expect.stringMatching(/\/id: duplicate ID/),
      expect.stringMatching(/\/slug: duplicate slug/),
    ]));
  });

  test('invalid legacy verification states fail instead of being discarded', () => {
    const invalid = {
      ...sourceTrails[0],
      id: 'invalid-verification',
      verified: { categories: ['route', 'invented-safe-state'] },
    };
    expect(legacyInputErrors(invalid)).toContain(
      'invalid-verification/legacy/verified/categories/1: unsupported verification category invented-safe-state'
    );
  });

  test('a missing canonical source fails clearly', () => {
    const record = JSON.parse(JSON.stringify(catalog.records[0]));
    record.sources = [];
    expect(validateCatalog([record])).toContain(
      `${record.id}/sources: expected at least one source`
    );
  });

  test('static generation loads and gates the same canonical catalog', () => {
    const fs = require('fs');
    const generator = fs.readFileSync(
      path.join(root, 'scripts', 'generate-trail-pages.js'),
      'utf8'
    );
    expect(generator).toContain("require('./load-production-trails')");
    expect(generator).toContain("require('./trail-adapter')");
    expect(generator).toContain("record.lifecycle === 'published'");
  });
});
