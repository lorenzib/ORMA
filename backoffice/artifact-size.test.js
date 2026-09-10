'use strict';

const { measureArtifact, fieldWeights, entryLabel, bytes, PROPERTY_LIMIT } = require('./workflows/artifact-size');
const { storedSize, parsed } = require('./cli/report-artifact-sizes');

describe('artifact size', () => {
  test('measures what Firestore measures, not what the object costs in memory', () => {
    // The document holds a JSON string, and the limit applies to that string.
    // Multi-byte characters count for what they are on the wire.
    expect(storedSize({ data: '{"a":1}' })).toBe(7);
    expect(bytes('é')).toBe(bytes('e') + 1);
  });

  test('names the key holding the weight', () => {
    const data = { summary: { n: 2 }, items: [{ id: 'a', blob: 'x'.repeat(4000) }] };
    const report = measureArtifact(data);
    expect(report.parts[0].key).toBe('items');
    expect(report.parts[0].count).toBe(1);
  });

  test('says whether to trim a field or keep fewer entries', () => {
    // The two shapes need opposite fixes, and a total tells them apart not at
    // all: 1.1 MB of one fat field is a schema change, 1.1 MB spread evenly is
    // a retention change.
    const oneFatField = measureArtifact({
      items: Array.from({ length:20 }, (unused, index) => ({ id:`t${index}`, geometry:'x'.repeat(3000), name:'n' })),
    });
    expect(oneFatField.heaviestArray.fields[0].field).toBe('geometry');
    expect(oneFatField.heaviestArray.fields[0].bytes / oneFatField.heaviestArray.bytes).toBeGreaterThan(0.5);

    const spread = measureArtifact({
      items: Array.from({ length:20 }, (unused, index) => ({ id:`t${index}`, a:'x'.repeat(300), b:'y'.repeat(300), c:'z'.repeat(300) })),
    });
    expect(spread.heaviestArray.fields[0].bytes / spread.heaviestArray.bytes).toBeLessThan(0.5);
  });

  test('labels entries by whatever id they carry, so the biggest is identifiable', () => {
    expect(entryLabel({ trailId:'lago-di-braies' }, 0)).toBe('lago-di-braies');
    expect(entryLabel({ candidateId:'c-1' }, 3)).toBe('c-1');
    // Nothing id-like: the position is still better than nothing.
    expect(entryLabel({ shade: 20 }, 7)).toBe('[7]');
    expect(entryLabel(null, 2)).toBe('[2]');
  });

  test('flags the ceiling before it is hit, not after', () => {
    // An artifact at 90% breaks on the next few entries, and the worker gives
    // no warning of its own -- it simply starts failing every pass.
    const near = measureArtifact({ blob:'x'.repeat(Math.round(PROPERTY_LIMIT * 0.9)) });
    expect(near.overLimit).toBe(false);
    expect(near.nearLimit).toBe(true);
    const over = measureArtifact({ blob:'x'.repeat(PROPERTY_LIMIT + 10) });
    expect(over.overLimit).toBe(true);
  });

  test('an unparseable document is reported, never crashed on', () => {
    expect(parsed({ data:'not json' })).toBeNull();
    expect(measureArtifact(null).total).toBe(4);
    expect(measureArtifact(null).parts).toEqual([]);
  });

  test('an artifact with no arrays still reports its keys', () => {
    const report = measureArtifact({ status:'healthy', runId:'abc' });
    expect(report.heaviestArray).toBeNull();
    expect(report.parts.map(part => part.key).sort()).toEqual(['runId', 'status']);
  });

  test('empty arrays are not offered as the culprit', () => {
    const report = measureArtifact({ empty:[], items:[{ id:'a', blob:'x'.repeat(100) }] });
    expect(report.heaviestArray.key).toBe('items');
  });

  test('fieldWeights ignores entries that are not objects', () => {
    expect(fieldWeights(['a', 3, null, { field:'x'.repeat(50) }])[0].field).toBe('field');
  });
});
