const fs = require('fs');
const path = require('path');
const { validateTrailRecord } = require('./scripts/trail-schema');

function fixture(name){
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'examples', name), 'utf8'));
}

describe('canonical trail schema', () => {
  test.each([
    ['trail.curated.example.json', 'curated'],
    ['trail.imported.example.json', 'osm'],
  ])('%s is valid', (name, origin) => {
    const record = fixture(name);
    expect(record.origin).toBe(origin);
    expect(validateTrailRecord(record)).toEqual([]);
  });

  test('DATA-04 segments place an advisory on an ordered stretch of the route', () => {
    const record = fixture('trail.curated.example.json');
    const [segment] = record.segments;

    expect(record.schemaVersion).toBe('1.1.0');
    expect(segment).toEqual(expect.objectContaining({
      type:'livestock', advisory:'leash-recommended', fromKm:2.1, toKm:3.4, status:'reviewed',
    }));
    expect(segment.toKm).toBeGreaterThan(segment.fromKm);
  });

  test('a segment that cannot be placed on the route is rejected', () => {
    const record = fixture('trail.curated.example.json');
    record.segments[0].toKm = 1.4;
    expect(validateTrailRecord(record)).toContain('/segments/0/toKm: must be greater than fromKm');

    const missing = fixture('trail.curated.example.json');
    missing.segments[0].fromKm = null;
    expect(validateTrailRecord(missing)).toContain(
      '/segments/0: fromKm and toKm are required to place an advisory');
  });

  test('an unrecognised advisory or segment type is rejected', () => {
    const record = fixture('trail.curated.example.json');
    record.segments[0].advisory = 'lead-on';
    record.segments[0].type = 'cows';
    const errors = validateTrailRecord(record);

    expect(errors.some(error => error.startsWith('/segments/0/advisory:'))).toBe(true);
    expect(errors.some(error => error.startsWith('/segments/0/type:'))).toBe(true);
  });

  test('an unknown behaviour attribute must still be declared as unknown', () => {
    const record = fixture('trail.curated.example.json');
    record.suitability.wildlifePresence = 'unknown';
    expect(validateTrailRecord(record)).toContain(
      '/suitability/wildlifePresence: unknown value is not declared in unknownFields');
  });

  test('coordinates use GeoJSON longitude, latitude order', () => {
    const record = fixture('trail.curated.example.json');
    expect(record.geometry.coordinates[0]).toEqual([11.57585, 46.41032]);
  });

  test('an undeclared unknown is rejected', () => {
    const record = fixture('trail.imported.example.json');
    record.unknownFields = record.unknownFields.filter(pointer => pointer !== '/metrics/descentM');
    expect(validateTrailRecord(record)).toContain('/metrics/descentM: unknown value is not declared in unknownFields');
  });

  test('a loop must have closed geometry', () => {
    const record = fixture('trail.curated.example.json');
    record.geometry.coordinates.pop();
    expect(validateTrailRecord(record)).toContain('/geometry/coordinates: loop geometry must be closed');
  });

  test('verified status requires complete evidence categories', () => {
    const record = fixture('trail.curated.example.json');
    record.verification.status = 'verified';
    expect(validateTrailRecord(record)).toContain(
      '/verification: verified records require a reviewer, date, and every category verified'
    );
  });
});
