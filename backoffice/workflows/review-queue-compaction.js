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
 * Those two took it from 94% to 57%, and unblocked the worker. They were not
 * enough on their own, and the measurement said so: a review still waiting is
 * 91-114 KB, eight of them are nearly the whole artifact, and twenty would
 * break it again. Trimming the route only touches the cartographer's share.
 *
 * So a waiting review keeps a summary and not the record. Everything the desk
 * renders without being asked -- the distances, whether the loop closes, the
 * claims, the sketch, the source link -- stays inline. The full agent output,
 * which the desk only shows when someone opens "Show the evidence", is fetched
 * from its own document at that point.
 *
 * And because none of that is a guarantee -- it is a smaller number multiplied
 * by a count nobody bounds -- the queue is fitted to a byte budget on the way
 * out. Over budget, the reviews waiting longest give up their summaries too,
 * newest first, until it fits. Degrading in a stated order beats failing every
 * write, which is what this artifact did for five hours.
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

/**
 * What the desk draws from an output without being asked. Everything else is
 * behind "Show the evidence", so it can live in the output's own document and
 * be fetched when that is opened.
 */
function summariseOutput(output) {
  if (!output || typeof output !== 'object') return output;
  const result = output.result || {};
  const geometry = result.geometry && Array.isArray(result.geometry.coordinates)
    ? {
      coordinates: simplifyCoordinates(result.geometry.coordinates),
      simplified: result.geometry.coordinates.length > MAX_PREVIEW_POINTS,
      simplifiedFromPointCount: result.geometry.coordinates.length,
    }
    : undefined;
  const summary = {
    agentId: output.agentId,
    jobId: output.jobId,
    // The pointer is the whole contract: without it the detail is unreachable
    // and this is data loss rather than compaction.
    resultRef: output.jobId ? `firestore:trail-specialist-output-${output.jobId}` : undefined,
    result: {
      summary: result.summary,
      recommendation: result.recommendation,
      comparison: result.comparison,
      assessment: result.assessment,
      source: result.source,
      // The checklist reads category and value; a claim's sources and evidence
      // are the part that is large, and the part behind the disclosure.
      claims: Array.isArray(result.claims)
        ? result.claims.map(claim => ({
          id: claim.id, category: claim.category, finding: claim.finding,
          proposedValue: claim.proposedValue,
        }))
        : undefined,
      ...(geometry ? { geometry } : {}),
      detailWithheld: true,
    },
  };
  return JSON.parse(JSON.stringify(summary));
}

/**
 * The retry ledger, as the desk states it: "water: source exhausted". The
 * attempts themselves carry the model's reasoning and are the bulk of it.
 */
function trimResolution(ledger) {
  if (!ledger || typeof ledger !== 'object') return ledger;
  const entries = Object.entries(ledger).map(([key, entry]) => [key, {
    agentId: entry && entry.agentId,
    claimId: entry && entry.claimId,
    category: entry && entry.category,
    originalFinding: entry && entry.originalFinding,
    state: entry && entry.state,
    attemptCount: entry && Array.isArray(entry.attempts) ? entry.attempts.length : undefined,
  }]);
  return Object.fromEntries(entries.map(([key, entry]) => [key,
    Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined))]));
}

/**
 * Blocking reasons are what the reviewer reads, so they are kept -- but a
 * single reason is one sentence, and one long enough to matter to this budget
 * is already too long to read on a card. Bounded rather than dropped, and the
 * truncation is visible.
 */
const MAX_REASON_CHARS = 300;
const MAX_REASONS = 40;

function capReasons(reasons) {
  if (!Array.isArray(reasons)) return reasons;
  const capped = reasons.slice(0, MAX_REASONS).map(reason => {
    const text = String(reason);
    return text.length > MAX_REASON_CHARS ? `${text.slice(0, MAX_REASON_CHARS)}…` : text;
  });
  if (reasons.length > MAX_REASONS) capped.push(`…and ${reasons.length - MAX_REASONS} more, in the full agent output`);
  return capped;
}

/** A waiting review, small enough to keep every waiting review. */
function summariseWaitingItem(item) {
  return {
    ...item,
    specialistOutputs: Array.isArray(item.specialistOutputs) ? item.specialistOutputs.map(summariseOutput) : item.specialistOutputs,
    claimResolution: trimResolution(item.claimResolution),
    blockingReasons: capReasons(item.blockingReasons),
  };
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
  if (item.state === 'awaiting-human') return summariseWaitingItem(item);
  if (!item.specialistOutputs && !item.claimResolution) return item;
  const { specialistOutputs, claimResolution, ...kept } = item;
  return { ...kept, specialistOutputRefs: outputRefs(item) };
}

/**
 * Applied on every write, so the backlog compacts itself on the first pass
 * that succeeds rather than needing a migration nobody would remember to run.
 */
function compactReviewQueue(queue) {
  if (!queue || !Array.isArray(queue.items)) return queue;
  return { ...queue, items: queue.items.map(compactDecidedItem) };
}

/**
 * Firestore's ceiling, less room for one more review to arrive before the next
 * write. Writing right up to the limit means the pass that adds a trail is the
 * pass that fails, which is exactly how this artifact broke.
 */
const QUEUE_BUDGET = 700_000;

function itemBytes(item) {
  return Buffer.byteLength(JSON.stringify(item) || '', 'utf8');
}

function queueBytes(queue) {
  return Buffer.byteLength(JSON.stringify(queue) || '', 'utf8');
}

/** Oldest first by when the gate opened, so "longest waiting" is well defined. */
function openedAt(item) {
  const value = item && (item.openedAt || item.updatedAt);
  const parsed = value ? new Date(value).valueOf() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** The evidence pointers an item keeps whenever it gives its evidence up. */
function outputRefs(item) {
  // One pointer per document. Several outputs can share a job id, and a list
  // repeating the same reference forty times is noise, not provenance.
  return [...new Set((item.specialistOutputs || [])
    .map(output => output && output.jobId).filter(Boolean)
    .map(jobId => `firestore:trail-specialist-output-${jobId}`))];
}

/** Tier 2: a waiting review gives up its summaries, keeping the pointers. */
function stripWaiting(item) {
  const { specialistOutputs, claimResolution, ...kept } = item;
  return { ...kept, specialistOutputRefs: outputRefs(item), detailWithheld: 'queue-budget' };
}

/** Tier 3: the reasons themselves, cut to the few that lead. */
const BUDGET_REASONS = 6;
function trimReasons(item) {
  const reasons = Array.isArray(item.blockingReasons) ? item.blockingReasons : [];
  if (reasons.length <= BUDGET_REASONS) return item;
  return {
    ...item,
    blockingReasons: [...reasons.slice(0, BUDGET_REASONS),
      `…and ${reasons.length - BUDGET_REASONS} more, in the full agent output`],
  };
}

/**
 * Tier 3b: the count and nothing else. A review that reaches here still
 * appears, still says it is blocked, and still points at its evidence -- a
 * trail waiting on a person must never vanish from the queue to save bytes.
 */
function countReasons(item) {
  const reasons = Array.isArray(item.blockingReasons) ? item.blockingReasons : [];
  if (!reasons.length) return item;
  return {
    ...item,
    blockingReasons: [`${reasons.length} blocking ${reasons.length === 1 ? 'reason' : 'reasons'}, in the full agent output`],
    detailWithheld: 'queue-budget',
  };
}

/** Tier 4: a decided review is already a stub; the decision itself is on the trail. */
function isProcessedStub(item) {
  return item && item.state !== 'awaiting-human';
}

/**
 * A summary is smaller than a record but still not bounded: it is multiplied
 * by a count nobody controls, and eight waiting reviews were already most of
 * the artifact. So the queue is fitted to a budget on the way out, in tiers,
 * stopping the moment it fits.
 *
 * Order matters and is a real choice, so it is stated rather than emergent:
 * the review that has waited longest gives way first, because the newest gates
 * are the ones being worked now and an old one can be re-read from the agent
 * outputs, which are never touched by any of this.
 *
 * The last tier drops decided reviews outright. They are already stubs by then
 * and the decision itself lives on the trail in trail-orchestration, so what
 * goes is a duplicate index entry, not a record.
 *
 * Degrading in a stated order beats failing every write, which is what this
 * artifact did for five hours on 2026-09-10.
 */
function fitReviewQueue(queue, options = {}) {
  const budget = options.budget || QUEUE_BUDGET;
  const compacted = compactReviewQueue(queue);
  if (!compacted || !Array.isArray(compacted.items)) return compacted;
  if (queueBytes(compacted) <= budget) return compacted;

  let items = compacted.items.slice();
  const withheld = [];
  const label = item => (item && (item.reviewId || item.candidateId)) || 'unnamed review';
  const oldestFirst = predicate => items
    .map((item, index) => ({ index, item }))
    .filter(entry => predicate(entry.item))
    .sort((a, b) => openedAt(a.item) - openedAt(b.item));

  const applyTier = (predicate, transform, record) => {
    for (const entry of oldestFirst(predicate)) {
      if (queueBytes({ ...compacted, items }) <= budget) return;
      const next = transform(entry.item);
      if (next === entry.item) continue;
      items[entry.index] = next;
      if (record) withheld.push(label(entry.item));
    }
  };

  applyTier(item => item && item.state === 'awaiting-human' && item.specialistOutputs, stripWaiting, true);
  applyTier(item => item && Array.isArray(item.blockingReasons), trimReasons, false);
  applyTier(item => item && Array.isArray(item.blockingReasons) && item.blockingReasons.length > 1, countReasons, true);

  // Last resort: drop decided stubs entirely, oldest first.
  if (queueBytes({ ...compacted, items }) > budget) {
    const droppable = oldestFirst(isProcessedStub);
    for (const entry of droppable) {
      if (queueBytes({ ...compacted, items }) <= budget) break;
      items[entry.index] = null;
    }
    items = items.filter(Boolean);
  }

  return {
    ...compacted,
    items,
    // Never silently: the desk has to be able to say why a card is thin.
    ...(withheld.length ? { detailWithheldFor: withheld, detailWithheldReason: 'queue-budget' } : {}),
  };
}

module.exports = {
  MAX_PREVIEW_POINTS,
  MAX_REASON_CHARS,
  MAX_REASONS,
  QUEUE_BUDGET,
  summariseOutput,
  trimResolution,
  capReasons,
  fitReviewQueue,
  BUDGET_REASONS,
  simplifyCoordinates,
  previewOutput,
  previewOutputs,
  compactDecidedItem,
  compactReviewQueue,
};
