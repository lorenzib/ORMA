'use strict';

const {
  MAX_PREVIEW_POINTS, simplifyCoordinates, previewOutput, compactDecidedItem, compactReviewQueue,
  summariseOutput, trimResolution, capReasons, fitReviewQueue, QUEUE_BUDGET,
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

  test('a review still waiting keeps everything the desk draws unasked', () => {
    // Distances, the sketch, the claims and the blockers are on the card. The
    // full agent record is behind "Show the evidence", so it is fetched then.
    const kept = compactDecidedItem(item('awaiting-human'));
    expect(kept.specialistOutputs).toHaveLength(1);
    expect(kept.claimResolution).toBeDefined();
    expect(kept.blockingReasons).toHaveLength(1);
    expect(kept.specialistOutputs[0].result.comparison.officialDistanceKm).toBe(4);
    expect(kept.specialistOutputs[0].result.geometry.coordinates).toHaveLength(MAX_PREVIEW_POINTS);
    expect(kept.specialistOutputs[0].resultRef).toBe('firestore:trail-specialist-output-job-awaiting-human');
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
    expect(advance).toMatch(/setArtifact\('dossier-review-queue',fitReviewQueue\(nextQueue\)\)/);
    const apply = fs.readFileSync(path.join(__dirname, 'workflows/apply-dossier-review.js'), 'utf8');
    expect(apply).toMatch(/const nextQueue=fitReviewQueue\(/);
  });

  test('an item with nothing to give up is returned untouched', () => {
    const bare = { reviewId:'r', state:'processed' };
    expect(compactDecidedItem(bare)).toBe(bare);
    expect(compactReviewQueue({ items:[] }).items).toEqual([]);
    expect(compactReviewQueue(null)).toBeNull();
  });

  test('a summary keeps every field the card renders, and drops the rest', () => {
    const output = summariseOutput({ agentId:'cartographer', jobId:'j1', result:{
      summary:'looks right', recommendation:'advance',
      comparison:{ officialDistanceKm:4 }, assessment:{ isClosed:true, closureDistanceM:3 },
      source:{ url:'https://example.test', authority:'Comune' },
      claims:[{ id:'c', category:'water', proposedValue:'none', finding:'supported-proposal',
        sources:Array.from({ length:20 }, () => ({ url:'https://long'.repeat(40) })) }],
      geometry:{ coordinates:coordinates(600) },
      openQuestions:['q'.repeat(4000)],
      internalTrace:'x'.repeat(20000),
    } });
    // Kept: what the desk shows before anyone asks.
    expect(output.result.summary).toBe('looks right');
    expect(output.result.comparison.officialDistanceKm).toBe(4);
    expect(output.result.assessment.isClosed).toBe(true);
    expect(output.result.source.url).toBe('https://example.test');
    expect(output.result.claims[0].proposedValue).toBe('none');
    expect(output.result.geometry.coordinates).toHaveLength(MAX_PREVIEW_POINTS);
    // Dropped: the bulk, which lives in the output's own document.
    expect(output.result.internalTrace).toBeUndefined();
    expect(output.result.openQuestions).toBeUndefined();
    expect(output.result.claims[0].sources).toBeUndefined();
    // And the pointer, without which this is data loss rather than compaction.
    expect(output.resultRef).toBe('firestore:trail-specialist-output-j1');
    expect(output.result.detailWithheld).toBe(true);
  });

  test('the retry ledger keeps its state and counts its attempts', () => {
    const trimmed = trimResolution({ water:{ category:'water', state:'source-exhausted',
      attempts:[{ note:'n'.repeat(900) }, { note:'m'.repeat(900) }] } });
    expect(trimmed.water.state).toBe('source-exhausted');
    expect(trimmed.water.attemptCount).toBe(2);
    expect(trimmed.water.attempts).toBeUndefined();
  });

  test('a blocking reason is bounded, and says when it was cut', () => {
    // These are what the reviewer reads, so they are capped rather than
    // dropped, and never silently.
    const capped = capReasons(['x'.repeat(5000), ...Array.from({ length:80 }, (u, i) => `reason ${i}`)]);
    expect(capped[0].endsWith('…')).toBe(true);
    expect(capped[capped.length - 1]).toMatch(/and \d+ more/);
  });

  test('the queue fits its budget at catalogue scale, without losing a review', () => {
    // A summary is smaller but not bounded: it is multiplied by a count nobody
    // controls. Eight waiting reviews were already most of the artifact.
    const heavy = index => ({
      reviewId:`r${index}`, state:'awaiting-human',
      openedAt:new Date(Date.UTC(2026, 0, 1) + index * 86400000).toISOString(),
      blockingReasons:Array.from({ length:30 }, () => 'x'.repeat(900)),
      specialistOutputs:Array.from({ length:4 }, (unused, n) => ({ agentId:`a${n}`, jobId:`j${index}-${n}`,
        result:{ summary:'s', geometry:{ coordinates:coordinates(900) }, trace:'t'.repeat(9000) } })),
      claimResolution:{ water:{ state:'x', attempts:Array.from({ length:5 }, () => ({ n:'n'.repeat(800) })) } },
    });
    [8, 50, 165].forEach(count => {
      const fitted = fitReviewQueue({ items:Array.from({ length:count }, (unused, index) => heavy(index)) });
      expect(Buffer.byteLength(JSON.stringify(fitted), 'utf8')).toBeLessThanOrEqual(QUEUE_BUDGET);
      // A trail waiting on a person must never vanish from the queue to save
      // bytes: that is the failure this whole file exists to avoid repeating.
      expect(fitted.items.filter(entry => entry.state === 'awaiting-human')).toHaveLength(count);
    });
  });

  test('the oldest review gives way first, and is told it did', () => {
    const at = index => new Date(Date.UTC(2026, 0, 1) + index * 86400000).toISOString();
    // Weight the summary keeps, not weight it drops: a fat internal trace is
    // already gone by the time the budget is measured.
    const heavy = index => ({ reviewId:`r${index}`, state:'awaiting-human', openedAt:at(index),
      blockingReasons:Array.from({ length:40 }, () => 'x'.repeat(300)),
      specialistOutputs:Array.from({ length:40 }, (unused, n) => ({ agentId:`a${n}`, jobId:`j${index}`,
        result:{ summary:'s', geometry:{ coordinates:coordinates(900) } } })) });
    const fitted = fitReviewQueue({ items:Array.from({ length:20 }, (unused, index) => heavy(index)) });
    expect(fitted.detailWithheldReason).toBe('queue-budget');
    // r0 opened first, so it is the first to give up its detail.
    expect(fitted.detailWithheldFor[0]).toBe('r0');
    const stripped = fitted.items.find(entry => entry.reviewId === 'r0');
    expect(stripped.specialistOutputs).toBeUndefined();
    expect(stripped.specialistOutputRefs).toEqual(['firestore:trail-specialist-output-j0']);
    expect(stripped.detailWithheld).toBe('queue-budget');
  });

  test('a queue that already fits is left alone', () => {
    const small = { items:[item('awaiting-human', 20)] };
    const fitted = fitReviewQueue(small);
    expect(fitted.detailWithheldFor).toBeUndefined();
    expect(fitted.items[0].specialistOutputs).toHaveLength(1);
  });

  test('the desk fetches withheld detail instead of showing a blank', () => {
    const fs = require('fs');
    const path = require('path');
    const desk = fs.readFileSync(path.join(__dirname, '..', 'trail-verify-desk.js'), 'utf8');
    // Loaded when opened, which is the only time it is read.
    expect(desk).toContain('function machineOutput');
    expect(desk).toMatch(/raw\.addEventListener\('toggle'/);
    expect(desk).toMatch(/output\.resultRef/);
    // And a thin card explains itself rather than reading as an empty result.
    expect(desk).toMatch(/The queue was too full to keep this review/);
  });
});
