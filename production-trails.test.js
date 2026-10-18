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

  // Built rather than borrowed from the catalogue.
  //
  // This used to name osm-1780768, whose figures it then had to keep chasing:
  // 6.19 km and 77.4 km before the member-role fix, 4.18 km and 53.4 km after
  // it, and now nothing at all -- dropping the fragments it was dragging
  // across the valley took it to 37.1 km with no jump, so it is published and
  // the test had no subject left. A rule about broken routes should not need a
  // broken route to survive in the catalogue to be testable.
  test('broken or unrealistic routes are held as drafts with field-level reasons', () => {
    const teleports = [[11.00, 46.50], [11.01, 46.50], [11.90, 46.50], [11.91, 46.50]];
    const tooLong = [];
    for (let i = 0; i < 700; i += 1) tooLong.push([11.00 + i * 0.001, 46.20]);
    const broken = {
      id: 'test-broken-route', name: 'A route with a hole and no end',
      area: 'Test', lat: 46.50, lng: 11.00, distance: 60, source: 'osm', curated: false,
      path: [...teleports, ...tooLong].map(([lng, lat]) => [lat, lng]),
    };
    const built = buildCanonicalCatalog([...sourceTrails, broken]);
    const held = built.excluded.find(entry => entry.id === 'test-broken-route');
    expect(held).toBeDefined();
    expect(held.reasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/geometry jump \d+(\.\d+)? km before point \d+/),
      expect.stringMatching(/distance \d+(\.\d+)? km exceeds the 50 km publication limit/),
    ]));
    expect(built.records.find(record => record.id === 'test-broken-route').lifecycle).toBe('draft');
  });

  // The invariant that actually protects the site: whatever the validator
  // holds back must never also be published. Checked in both directions so a
  // record cannot be held back in the report and live on the site, or carry a
  // draft lifecycle while nothing explains why.
  test('every held-back route is a draft, and every draft is held back', () => {
    const heldIds = catalog.excluded.map(entry => entry.id).sort();
    const draftIds = catalog.records
      .filter(record => record.lifecycle === 'draft')
      .map(record => record.id)
      .sort();
    expect(draftIds).toEqual(heldIds);
    for (const entry of catalog.excluded) {
      expect(entry.reasons.length).toBeGreaterThan(0);
    }
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
