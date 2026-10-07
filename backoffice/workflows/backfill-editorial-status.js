'use strict';

// A one-off reconciliation for outputs decided before the decision moved them.
//
// Until #649, ingestTrailReviews recorded an editorial decision, wrote the
// review queue and the staging artifact, and never wrote the execution -- so
// the output's status stayed `ready-for-review` however it had been decided.
// #649 stops that happening again; it does not revisit what already happened.
//
// On the live database that leaves six outputs -- the copy and visual jobs of
// tre-cime, cinque-torri-assisted and lago-braies -- reading `ready-for-review`
// with every decision approved and all three trails on the website. The count
// is wrong, and worse, a genuine queue arriving tomorrow would be
// indistinguishable from that residue.
//
// This replays what was decided rather than deciding anything. Three rules make
// that claim checkable:
//
//   - A status only moves on a decision **recorded in a processed submission**.
//     An output nobody decided on is left exactly as it is, and so is one whose
//     submission is still queued or was blocked -- that decision has not been
//     applied, so neither should its status be.
//   - The stored outcome is preferred over a recomputed one. It is what was
//     actually recorded at the time; recomputing is only a fallback for a
//     submission written before outcomes were kept.
//   - It is idempotent. A second run finds nothing to move, because the moves
//     are derived by comparing the current status against the decided one.
//
// The applier itself is #649's, not a second copy: if the two ever disagreed,
// a backfilled output would differ from one decided normally.

const {recordVerifiedTrailReview,applyVerifiedTrailReviewStatus}=require('./apply-content-review');
const {REVIEWED_STATUSES,validateContentExecution}=require('../contracts/content-result-v1');
const {latestDecisions}=require('./build-publication-staging');

/**
 * The outcome each output should carry, from the submissions that were applied.
 *
 * Submissions are read in array order and the last decision for a job wins,
 * which is the rule latestDecisions already uses for staging -- so the backfill
 * and the staging builder cannot disagree about which decision is current.
 */
function decidedOutcomes(execution, reviewQueue){
  const processed={submissions:(reviewQueue?.submissions||[]).filter(submission=>submission.status==='processed')};
  const current=latestDecisions(processed);
  const storedOutcome=new Map();
  for(const submission of processed.submissions){
    for(const outcome of submission.outcomes||[]){
      if(outcome&&outcome.jobId)storedOutcome.set(outcome.jobId,{...outcome,submissionId:submission.submissionId});
    }
  }
  const outcomes=[];
  for(const [jobId,decision] of current){
    const stored=storedOutcome.get(jobId);
    if(stored&&REVIEWED_STATUSES.includes(stored.status)){outcomes.push(stored);continue;}
    // No usable stored outcome: recompute the one this decision would produce
    // now, through the same function the live path uses.
    const [recomputed]=recordVerifiedTrailReview(execution,[decision]);
    if(recomputed&&REVIEWED_STATUSES.includes(recomputed.status)){
      outcomes.push({...recomputed,submissionId:decision.submissionId,recomputed:true});
    }
  }
  return outcomes;
}

/**
 * What the backfill would change, and the execution it would write.
 *
 * `moves` is the audit trail: one row per output whose status changes, saying
 * where it came from, where it is going, which submission decided it and
 * whether that came from the stored outcome or was recomputed. An empty
 * `moves` means there is nothing to do, which is the expected steady state.
 */
function planEditorialStatusBackfill(execution, reviewQueue){
  const outcomes=decidedOutcomes(execution,reviewQueue);
  const byJob=new Map((execution?.outputs||[]).map(output=>[output.jobId,output]));
  const applicable=outcomes.filter(outcome=>{
    const output=byJob.get(outcome.jobId);
    return Boolean(output)&&output.status!==outcome.status;
  });
  const next=applyVerifiedTrailReviewStatus(execution,applicable);
  return {
    next,
    changed:next!==execution,
    moves:applicable.map(outcome=>({
      jobId:outcome.jobId,
      candidateId:byJob.get(outcome.jobId)?.candidateId||null,
      from:byJob.get(outcome.jobId)?.status||null,
      to:outcome.status,
      action:outcome.action||null,
      submissionId:outcome.submissionId||null,
      source:outcome.recomputed?'recomputed':'stored-outcome',
    })),
    // Said explicitly so a run that moves nothing can be told from a run that
    // found nothing decided -- the first is done, the second is a surprise.
    decidedOutputs:outcomes.length,
    errors:validateContentExecution(next),
  };
}

module.exports={decidedOutcomes,planEditorialStatusBackfill};
