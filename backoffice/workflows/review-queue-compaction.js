'use strict';

/**
 * Keeping dossier-review-queue under Firestore's 1 MB property limit.
 *
 * On 2026-09-10 the worker began failing every pass:
 *
 *   3 INVALID_ARGUMENT: The value of property "data" is longer than
 *   1048487 bytes.
 *
 * The artifact was 960 KB of a 1,024 KB ceiling — under it, so the copy that
 * existed was fine and the next write was not. Two things put it there, and
 * both need fixing or it comes straight back.
 *
 * 1. The queue is append-only. Items are pushed when a gate opens and marked
 *    `processed` when it is decided, but nothing ever removes them, so every
 *    review ever decided still carried its full evidence. 29 of 33 items were
 *    decided, and the desk shows none of them: it renders `awaiting-human`
 *    only. A decided review needs its decision kept, not its evidence — and
 *    the evidence was never unique to the queue anyway. Each specialist output
 *    is already its own document at `trail-specialist-output-<jobId>`; the
 *    queue held a second copy.
 *
 * 2. The copy is full-resolution. Geometry is 92% of a cartographer output —
 *    23.5 KB of 25.6 KB — and the desk's only use for it is a 700x300 SVG
 *    sketch inside "Show the evidence". A few hundred coordinates draw that no
 *    better than eighty do.
 *
 * Fixing only the first would still break: 165 catalogue trails all reaching
 * the gate at 29 KB each is 4.8 MB. Fixing only the second leaves an
 * append-only log that fills again more slowly. Together the same queue is
 * about 12% of the limit and stays there.
 */

/**
 * Enough points to draw the route recognisably at the size it is drawn.
 * The SVG is 700px wide, so eighty points is roughly one every nine pixels.
 */
const MAX_PREVIEW_POINTS = 80;

/**
 * Evenly spaced samples, keeping the first and last exactly. Keeping the true
 * last point matters: dropping it opens a visible gap in a loop, and whether a
 * route closes is one of the things the reviewer is looking at.
 */
function simplifyCoordinates(coordinates, max = MAX_PREVIEW_POINTS) {
  if (!Array.isArray(coordinates) || coordinates.length <= max || max < 2) return coordinates;
  const step = (coordinates.length - 1) / (max - 1);
  const sampled = [];
  for (let index = 0; index < max; index += 1) sampled.push(coordinates[Math.round(index * step)]);
  sampled[sampled.length - 1] = coordinates[coordinates.length - 1];
  return sampled;
}

/** One specialist output, shrunk to what a person reviewing it needs to see. */
function previewOutput(output) {
  const result = output && output.result;
  const coordinates = result && result.geometry && result.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length <= MAX_PREVIEW_POINTS) return output;
  return {
    ...output,
    result: {
      ...result,
      geometry: {
        ...result.geometry,
        coordinates: simplifyCoordinates(coordinates),
        // Say that this is a sketch, so nothing downstream mistakes it for the
        // surveyed line. The full geometry is in the output's own document.
        simplified: true,
        simplifiedFromPointCount: coordinates.length,
      },
    },
    resultRef: `firestore:trail-specialist-output-${output.jobId}`,
  };
}

function previewOutputs(outputs) {
  return Array.isArray(outputs) ? outputs.map(previewOutput) : outputs;
}

/**
 * A decided review keeps what it decided and drops what it decided from. The
 * evidence stays reachable: every output it held is its own document, and the
 * ids are kept here so the trail from decision back to evidence is unbroken.
 */
function compactDecidedItem(item) {
  if (!item || typeof item !== 'object') return item;
  if (item.state === 'awaiting-human') return { ...item, specialistOutputs: previewOutputs(item.specialistOutputs) };
  if (!item.specialistOutputs && !item.claimResolution) return item;
  const { specialistOutputs, claimResolution, ...kept } = item;
  return {
    ...kept,
    specialistOutputRefs: (specialistOutputs || [])
      .map(output => output && output.jobId)
      .filter(Boolean)
      .map(jobId => `firestore:trail-specialist-output-${jobId}`),
  };
}

/**
 * Applied on every write, so the backlog compacts itself on the first pass
 * that succeeds rather than needing a migration nobody would remember to run.
 */
function compactReviewQueue(queue) {
  if (!queue || !Array.isArray(queue.items)) return queue;
  return { ...queue, items: queue.items.map(compactDecidedItem) };
}

module.exports = {
  MAX_PREVIEW_POINTS,
  simplifyCoordinates,
  previewOutput,
  previewOutputs,
  compactDecidedItem,
  compactReviewQueue,
};
