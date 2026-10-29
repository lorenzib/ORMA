'use strict';

/**
 * A walk verified by hand is recorded in the backoffice too.
 *
 * Verification is done by hand in Claude while paid research is off
 * (OPERATING_STANDARD.md, "Paid research is off; verification is done by
 * hand"), and it lands in the published record: a `trail-audits.js` entry with
 * `tier: 'route-audited'` and a verified graduation. Nothing told the
 * orchestration. On 23 October the site showed 71 Verified while the trail
 * board filed sixteen of them as "record and site disagree" and dozens more
 * under Research or Rejected, because the board follows the orchestration and
 * the orchestration still held whatever the pipeline last thought.
 *
 * So the record is copied across, honestly: the trail moves to its own state,
 * `verified-by-hand`, never to `ready-for-editorial` -- the evidence policy did
 * not approve it, and saying so would make the pipeline's own pass rate a lie.
 * The state keeps who verified it, when, how many sources, and where the
 * pipeline had got to. Queued work the trail still owns is retired, because a
 * walk verified by hand is changed by hand and research on it is credit spent
 * on an answer nobody will use.
 *
 * A seal later taken off by hand (the climb-and-time rule withdrew six on 24
 * October) sends the trail to `imported`, resting: it reopens only when a
 * source appears, the same as any walk with nothing official to research from.
 *
 * The sources themselves are not copied. Until 29 October every record carried
 * the trail's whole source list -- up to twelve long sentences, already in
 * `trail-audits.js` -- and with 244 walks verified by hand that list was most of
 * the orchestration. On 28 October it took the artifact past Firestore's
 * 1,048,487-byte ceiling and every worker pass failed on its first write
 * (#1143). The board reads the sources from the published record, the one
 * place they live; the orchestration keeps the count.
 *
 * Pure, so the worker pass and the push-triggered sync cannot disagree.
 */

const HAND_STATE = 'verified-by-hand';
const HAND_STAGE = 'verified-by-hand';
const WITHDRAWN_STAGE = 'hand-verification-withdrawn';
const RETIRED_REASON = 'the trail was verified by hand';
const MAX_SOURCES = 12;

/** The same test the publisher refuses on (materialize-approved-publications). */
function verifiedByHand(trail){
  return trail?.tier === 'route-audited' && trail?.graduation?.status === 'verified';
}

/** The sources a hand verification rests on, from the published record. */
function handSources(trail){
  const sources = Array.isArray(trail?.verified?.sources) ? trail.verified.sources : [];
  return sources.map(String).slice(0, MAX_SOURCES);
}

function handRecord(trail, at){
  const sources = Array.isArray(trail?.verified?.sources) ? trail.verified.sources : [];
  return {
    reviewedAt: trail.reviewedAt || trail.verifiedAt || trail?.verified?.date || null,
    reviewedBy: trail.reviewedBy || null,
    sourceCount: sources.length,
    recordedAt: at,
  };
}

/**
 * A record written before 29 October still carries the copied source list.
 * Dropped wherever it is found, so the artifact shrinks on its next write
 * rather than waiting for each walk to be re-verified. Returns whether it did.
 */
function dropCopiedSources(flow){
  const hand = flow?.handVerification;
  if(!hand || hand.sources === undefined) return false;
  const { sources, ...kept } = hand;
  flow.handVerification = { ...kept, sourceCount: kept.sourceCount ?? (Array.isArray(sources) ? sources.length : 0) };
  return true;
}

/**
 * @param trails         the production catalogue
 * @param orchestration  the `trail-orchestration` artifact (may be null)
 * @param jobs           queued jobs, to find the ones a hand-verified trail owns
 * @returns {{orchestration, recorded, withdrawn, compacted, retireJobIds}}
 *          orchestration is null when nothing changed, so a caller writes only
 *          when it must
 */
function planHandVerifications({ trails = [], orchestration = null, jobs = [], at = new Date().toISOString() } = {}){
  const base = orchestration || { contractVersion: '1.0.0', publicMutationAllowed: false, trails: [] };
  const next = JSON.parse(JSON.stringify(base));
  const flows = new Map(next.trails.map(flow => [String(flow.trailId || flow.candidateId), flow]));
  const byHand = new Map(trails.filter(verifiedByHand).map(trail => [String(trail.id), trail]));
  const recorded = [];
  const withdrawn = [];
  const compacted = next.trails.filter(dropCopiedSources).map(flow => String(flow.trailId || flow.candidateId));
  for(const [id, trail] of byHand){
    const flow = flows.get(id);
    // The evidence policy passed it before it was checked by hand: that is
    // true, and the board already says Passed. Leave it.
    if(flow?.state === 'ready-for-editorial') continue;
    if(flow?.state === HAND_STATE){
      // Already recorded. A re-verification on new sources is still news.
      const fresh = handRecord(trail, at);
      if(flow.handVerification?.reviewedAt !== fresh.reviewedAt){
        flow.handVerification = { ...fresh, previousState: flow.handVerification?.previousState || null };
        flow.updatedAt = at;
        recorded.push(id);
      }
      continue;
    }
    if(flow){
      flow.handVerification = { ...handRecord(trail, at), previousState: flow.state };
      flow.state = HAND_STATE;
      flow.stage = HAND_STAGE;
      flow.gate = null;
      flow.blockers = [];
      delete flow.pendingRevisionJobId;
      flow.updatedAt = at;
    }else{
      // Verified by hand before the pipeline ever admitted it. It still gets a
      // record, so the backoffice holds every verified walk and the intake
      // never admits it to be researched again.
      next.trails.push({ trailId: id, candidateId: id, trailName: trail.name || id,
        state: HAND_STATE, stage: HAND_STAGE, priorityScore: 0,
        sourceTrail: { origin: 'hand-verification', externalRelationId: null, baselineBlockers: [] },
        attempts: {}, resolutionAttempts: {}, jobIds: [], currentJobId: null, gate: null, latestOutputRef: null,
        blockers: [], handVerification: { ...handRecord(trail, at), previousState: null },
        publicMutationAllowed: false, updatedAt: at });
    }
    recorded.push(id);
  }
  for(const flow of next.trails){
    const id = String(flow.trailId || flow.candidateId);
    if(flow.state !== HAND_STATE || byHand.has(id)) continue;
    flow.state = 'imported';
    flow.stage = WITHDRAWN_STAGE;
    flow.handVerification = { ...(flow.handVerification || {}), withdrawnAt: at };
    flow.updatedAt = at;
    withdrawn.push(id);
  }
  const settled = new Set(next.trails.filter(flow => flow.state === HAND_STATE).map(flow => String(flow.trailId || flow.candidateId)));
  const retireJobIds = (jobs || [])
    .filter(job => job && job.status === 'queued' && settled.has(String(job.candidateId)))
    .map(job => job.id);
  const changed = recorded.length > 0 || withdrawn.length > 0 || compacted.length > 0;
  return { orchestration: changed ? next : null, recorded, withdrawn, compacted, retireJobIds };
}

module.exports = { HAND_STATE, HAND_STAGE, WITHDRAWN_STAGE, RETIRED_REASON, MAX_SOURCES, verifiedByHand, handSources, planHandVerifications };
