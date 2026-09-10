'use strict';

const {
  MAX_PREVIEW_POINTS, simplifyCoordinates, previewOutput, compactDecidedItem, compactReviewQueue,
} = require('./workflows/review-queue-compaction');
const { measureArtifact } = require('./workflows/artifact-size');

function coordinates(count) {
  return Array.from({ length:count }, (unused, index) => [46.5 + index * 1e-5, 11.6 + index * 1e-5]);
}
function item(state, points = 600) {
  return {
    reviewId:`review-${state}`, candidateId:'osm-1', state,
    blockingReasons:['logistics/recommended-start: required'],
    specialistOutputs:[{ agentId:'cartographer', jobId:`job-${state}`,
      result:{ summary:'ok', comparison:{ officialDistanceKm:4 }, geometry:{ coordinates:coordinates(points) } } }],
    claimResolution:{ water:{ attempts:[1,2,3] } },
  };
}

describe('review queue compaction', () => {
  test('a decided review keeps its decision and gives up its evidence', () => {
    // The desk renders awaiting-human only, so a processed item's outputs are
    // read by nobody -- and they were a second copy: every one of them is
    // already its own trail-specialist-output document.
    const compacted = compactDecidedItem({ ...item('processed'), decision:{ action:'approve' } });
    expect(compacted.specialistOutputs).toBeUndefined();
    expect(compacted.claimResolution).toBeUndefined();
    expect(compacted.decision).toEqual({ action:'approve' });
    // The trail from decision back to evidence stays unbroken.
    expect(compacted.specialistOutputRefs).toEqual(['firestore:trail-specialist-output-job-processed']);
  });

  test('a review still waiting keeps everything the desk shows', () => {
    const kept = compactDecidedItem(item('awaiting-human'));
    expect(kept.specialistOutputs).toHaveLength(1);
    expect(kept.claimResolution).toBeDefined();
    expect(kept.blockingReasons).toHaveLength(1);
    expect(kept.specialistOutputs[0].result.comparison.officialDistanceKm).toBe(4);
  });

  test('the route is sampled, not truncated', () => {
    // Truncating would draw half a route and read as a broken one.
    const full = coordinates(600);
    const preview = simplifyCoordinates(full);
    expect(preview).toHaveLength(MAX_PREVIEW_POINTS);
    expect(preview[0]).toEqual(full[0]);
    // The true last point is kept exactly: dropping it opens a gap in a loop,
    // and whether a route closes is one of the things being reviewed.
    expect(preview[preview.length - 1]).toEqual(full[full.length - 1]);
  });

  test('a short route is left exactly as it is', () => {
    const short = coordinates(12);
    expect(simplifyCoordinates(short)).toBe(short);
    const output = { agentId:'cartographer', jobId:'j', result:{ geometry:{ coordinates:short } } };
    expect(previewOutput(output)).toBe(output);
  });

  test('a simplified route says so, so it is never mistaken for the surveyed line', () => {
    const preview = previewOutput({ agentId:'cartographer', jobId:'j',
      result:{ geometry:{ coordinates:coordinates(600) } } });
    expect(preview.result.geometry.simplified).toBe(true);
    expect(preview.result.geometry.simplifiedFromPointCount).toBe(600);
    expect(preview.resultRef).toBe('firestore:trail-specialist-output-j');
  });

  test('the queue that broke the worker fits, and keeps fitting', () => {
    // 33 items, 29 of them decided, is what stood at 960 KB of a 1,024 KB
    // ceiling -- under it, so the copy that existed was fine and the next
    // write was not.
    const before = { items:[
      ...Array.from({ length:29 }, () => item('processed')),
      ...Array.from({ length:4 }, () => item('awaiting-human')),
    ] };
    const after = compactReviewQueue(before);
    const beforeBytes = measureArtifact(before).total;
    const afterBytes = measureArtifact(after).total;
    expect(afterBytes).toBeLessThan(beforeBytes * 0.2);

    // And the case that fixing only the decided items would still fail on:
    // every catalogue trail reaching the gate at once.
    const allWaiting = compactReviewQueue({ items:Array.from({ length:165 }, () => item('awaiting-human')) });
    expect(measureArtifact(allWaiting).total).toBeLessThan(1_048_487);
  });

  test('compaction is applied where the queue is written, not only where it is decided', () => {
    // The backlog was already over the line, so a pass that only compacts new
    // decisions would keep failing on the write it has to make first.
    const fs = require('fs');
    const path = require('path');
    const advance = fs.readFileSync(path.join(__dirname, 'workflows/advance-trail-orchestration.js'), 'utf8');
    expect(advance).toMatch(/setArtifact\('dossier-review-queue',compactReviewQueue\(nextQueue\)\)/);
    const apply = fs.readFileSync(path.join(__dirname, 'workflows/apply-dossier-review.js'), 'utf8');
    expect(apply).toMatch(/const nextQueue=compactReviewQueue\(/);
  });

  test('an item with nothing to give up is returned untouched', () => {
    const bare = { reviewId:'r', state:'processed' };
    expect(compactDecidedItem(bare)).toBe(bare);
    expect(compactReviewQueue({ items:[] }).items).toEqual([]);
    expect(compactReviewQueue(null)).toBeNull();
  });
});
