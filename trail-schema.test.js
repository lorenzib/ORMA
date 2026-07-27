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
