'use strict';

// review-queue-compaction summarises a waiting item to keep the queue inside
// Firestore's 1 MB property ceiling. Each claim keeps its id, category, finding
// and value; its sources -- the bulky part -- are replaced by a pointer to the
// full specialist output, and the comment there calls that pointer "the whole
// contract: without it the detail is unreachable and this is data loss rather
// than compaction".
//
// Nothing ever followed the pointer. compileVerifiedDossier reads the queue
// item directly, so once a waiting item had been summarised its
// recommended-start claim had no sources and approval threw "requires a sourced
// recommended start" -- for evidence sitting in the artifact the pointer named.
// All seven dossiers at the gate on 6 October were in that state, and no trail
// has ever been verified on this database.
//
// This is the other half of that contract.

const PREFIX = 'firestore:';

function withheld(output){
  return Boolean(output && output.result && output.result.detailWithheld);
}

function artifactIdFrom(ref){
  return typeof ref === 'string' && ref.startsWith(PREFIX) ? ref.slice(PREFIX.length) : null;
}

async function rehydrateOutput(store, output){
  if(!withheld(output)) return output;
  const id = artifactIdFrom(output.resultRef);
  // A summary with no pointer, or one naming an artifact that is gone, is as far
  // as this can get. Returning the summary leaves the gate to refuse on evidence
  // it cannot see, which is the honest outcome: a refusal beats a verification
  // resting on claims nobody could read back.
  if(!id) return output;
  const full = await store.getArtifact(id);
  if(!full) return output;
  return { ...output, result: full, rehydratedFrom: output.resultRef };
}

async function rehydrateItem(store, item){
  if(!item || !Array.isArray(item.specialistOutputs)) return item;
  if(!item.specialistOutputs.some(withheld)) return item;
  const specialistOutputs = [];
  for(const output of item.specialistOutputs) specialistOutputs.push(await rehydrateOutput(store, output));
  return { ...item, specialistOutputs };
}

/**
 * The queue with one item's withheld detail restored, in memory only.
 *
 * Only the item being decided, and only one at a time: restoring the whole
 * queue would rebuild exactly the megabyte the compaction exists to avoid. The
 * caller must not persist what this returns -- on the approve path it does not,
 * because an approved item becomes decided and compactDecidedItem drops its
 * outputs entirely.
 */
async function rehydrateReviewQueue(store, queue, reviewId){
  const items = queue && Array.isArray(queue.items) ? queue.items : null;
  if(!items) return queue;
  const index = items.findIndex(item => item.reviewId === reviewId);
  if(index < 0) return queue;
  const rehydrated = await rehydrateItem(store, items[index]);
  if(rehydrated === items[index]) return queue;
  const next = items.slice();
  next[index] = rehydrated;
  return { ...queue, items: next };
}

module.exports = { PREFIX, withheld, artifactIdFrom, rehydrateOutput, rehydrateItem, rehydrateReviewQueue };
