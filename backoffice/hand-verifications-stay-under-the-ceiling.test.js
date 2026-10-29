'use strict';

const { planHandVerifications, HAND_STATE } = require('./workflows/record-hand-verifications');
const { buildTrailBoard } = require('./workflows/build-trail-board');
const { recordHandVerifications } = require('./workflows/run-live-backoffice-worker');
const { validateTrailOrchestration } = require('./contracts/trail-orchestration-v1');
const { PROPERTY_LIMIT } = require('./workflows/artifact-size');

// #1143. From 28 October 00:54 every write of trail-orchestration failed with
// "The value of property \"data\" is longer than 1048487 bytes", first in the
// hand-verifications sync and then in every worker pass, which runs the same
// step first. 244 walks were verified by hand, and each record carried the
// walk's whole source list, copied from trail-audits.js: twelve long sentences
// at most, about 900 bytes a walk, read back only by the board -- which has the
// published record in hand anyway.

const ALL = ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];
const AT = '2026-10-29T09:00:00.000Z';
const SOURCE = 'Gemeinde Villnöss, Verordnung über die Haltung und Führung von Hunden (Gemeinderat 16/2010), Art. 4 and 8';

const byHand = (id, sources = Array.from({ length: 12 }, (_, index) => `${SOURCE} (${index + 1})`)) => ({
  id, name: `Trail ${id}`, area: 'Somewhere / Valley', region: 'dolomites', path: [[46.5, 11.6], [46.51, 11.61]], curated: true,
  tier: 'route-audited', reviewedAt: '2026-10-23', reviewedBy: 'ORMA route audit',
  graduation: { status: 'verified', required: ALL, completed: ALL, blockers: {} },
  verified: { categories: ALL.slice(5), sources, date: '2026-10-23' },
});
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');

/** A record as the sync wrote it until 29 October: the source list on every walk. */
function legacyRecord(trails){
  const plan = planHandVerifications({ trails, at: '2026-10-28T00:46:00.000Z' }).orchestration;
  plan.trails.forEach((flow, index) => {
    flow.handVerification = { ...flow.handVerification, sources: trails[index].verified.sources };
    delete flow.handVerification.sourceCount;
  });
  return plan;
}

describe('the hand verifications keep the orchestration writable', () => {
  test('a record keeps how many sources a walk rests on, not the sentences', () => {
    const recorded = planHandVerifications({ trails: [byHand('a')], at: AT }).orchestration.trails[0];
    expect(recorded.handVerification.sources).toBeUndefined();
    expect(recorded.handVerification.sourceCount).toBe(12);
  });

  test('the whole catalogue verified by hand leaves most of the ceiling to the pipeline', () => {
    // 398 walks in the catalogue on 29 October; 244 of them verified by hand.
    const trails = Array.from({ length: 400 }, (_, index) => byHand(`walk-${index}`));
    const plan = planHandVerifications({ trails, at: AT });
    expect(validateTrailOrchestration(plan.orchestration)).toEqual([]);
    expect(bytes(plan.orchestration)).toBeLessThan(PROPERTY_LIMIT * 0.25);
    // With the lists copied, the same walks took more than half of it.
    expect(bytes(legacyRecord(trails))).toBeGreaterThan(PROPERTY_LIMIT * 0.5);
  });

  test('a record already carrying the copied lists shrinks on the next pass, even with nothing new to record', () => {
    const trails = Array.from({ length: 400 }, (_, index) => byHand(`walk-${index}`));
    const before = legacyRecord(trails);
    const plan = planHandVerifications({ trails, orchestration: before, at: AT });
    expect(plan.recorded).toEqual([]);
    expect(plan.compacted).toHaveLength(400);
    expect(plan.orchestration.trails.every(flow => flow.state === HAND_STATE && flow.handVerification.sources === undefined)).toBe(true);
    expect(plan.orchestration.trails[0].handVerification.sourceCount).toBe(12);
    expect(bytes(plan.orchestration)).toBeLessThan(bytes(before) / 3);
    // And a second pass has nothing left to do, so it writes nothing.
    expect(planHandVerifications({ trails, orchestration: plan.orchestration, at: AT }).orchestration).toBeNull();
  });

  test('a withdrawn seal drops its copied list too', () => {
    const before = legacyRecord([byHand('gone')]);
    const plan = planHandVerifications({ trails: [], orchestration: before, at: AT });
    expect(plan.withdrawn).toEqual(['gone']);
    expect(plan.orchestration.trails[0].handVerification).toMatchObject({ sourceCount: 12, withdrawnAt: AT });
    expect(plan.orchestration.trails[0].handVerification.sources).toBeUndefined();
  });

  test('the board still shows the sources, from the published record', () => {
    const trail = byHand('a', ['Tourist board page', 'Province trail register']);
    const recorded = planHandVerifications({ trails: [trail], at: AT }).orchestration;
    const row = buildTrailBoard({ trails: [trail], orchestration: recorded, at: AT, slugs: {} }).trails[0];
    expect(row.hand.sources).toEqual(['Tourist board page', 'Province trail register']);
  });

  test('the worker writes the record the way it measured it', async () => {
    const trails = Array.from({ length: 300 }, (_, index) => byHand(`walk-${index}`));
    const writes = [];
    const store = {
      getArtifact: async () => legacyRecord(trails),
      setArtifact: async (id, data) => { writes.push({ id, size: bytes(data), data }); },
      listJobs: async () => [],
    };
    const result = await recordHandVerifications(store, { productionTrails: trails, at: AT });
    expect(result.compacted).toHaveLength(300);
    expect(writes).toHaveLength(1);
    expect(writes[0].id).toBe('trail-orchestration');
    expect(writes[0].data.trails.some(flow => flow.handVerification.sources)).toBe(false);
  });
});
