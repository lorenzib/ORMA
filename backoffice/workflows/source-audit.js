'use strict';

/**
 * The part of the evidence audit that is counting, not judgement.
 *
 * The Evidence Librarian is asked to audit specialist outputs for "source
 * authority, freshness, duplication, applicability and claim-to-source
 * traceability". Three of those five are mechanical: whether a source names an
 * authority at all, whether it carries an access date, and whether one page is
 * being made to answer everything. A model asked to check them will sometimes
 * notice and sometimes not, and it checks them at stage five, two stages after
 * the claim was written.
 *
 * So they are counted here, deterministically, and handed to the Librarian as
 * findings. What is left for it is the half that needs reading: whether a
 * source actually describes this walk, whether it is the right kind of source
 * for the claim, and whether two sources disagree.
 *
 * This reports. It never downgrades a claim: a missing access date is a gap in
 * the record, not evidence that the fact is wrong, and sending it back round
 * the research ladder would spend a search to learn nothing. Only the gate's
 * own requirements downgrade, and those are checked where they are required.
 */

// Past this, an access date is old enough that a reader should be told rather
// than an operational fact being quietly restated. The resolution policy uses
// the same year for an opening-hours or dog rule having moved.
const STALE_AFTER_DAYS = 365;
// One page answering more claims than this in a single output is the agent
// leaning on a single read rather than scouting the ladder.
const RELIANCE_SHARE = 0.6;

function claimsOf(outputs){
  return (outputs || []).flatMap(output => {
    const agentId = output?.agentId || output?.result?.agentId || null;
    const claims = output?.claims || output?.result?.claims || [];
    return (Array.isArray(claims) ? claims : []).map(claim => ({ agentId, claim }));
  });
}

function daysBetween(from, to){
  const start = new Date(from);
  if(Number.isNaN(start.getTime())) return null;
  return Math.round((new Date(to).getTime() - start.getTime()) / 86400000);
}

/**
 * What the counting can establish about a set of specialist outputs.
 *
 * `at` is the day the audit runs, so a stale date is stale relative to the run
 * rather than to whenever this happens to be read.
 */
function auditSources(outputs, options = {}){
  const at = options.at || new Date().toISOString();
  const staleAfter = Number.isFinite(options.staleAfterDays) ? options.staleAfterDays : STALE_AFTER_DAYS;
  const entries = claimsOf(outputs);
  const withoutAuthority = [];
  const withoutAccessDate = [];
  const stale = [];
  const uses = new Map();
  let cited = 0;
  for(const { agentId, claim } of entries){
    for(const source of claim?.sources || []){
      const url = String(source?.url || '').trim();
      if(!url) continue;
      cited += 1;
      uses.set(url, (uses.get(url) || 0) + 1);
      const where = { agentId, claimId: claim.id, url };
      if(!String(source?.authority || '').trim()) withoutAuthority.push(where);
      const accessed = String(source?.accessedAt || '').trim();
      if(!accessed){ withoutAccessDate.push(where); continue; }
      const age = daysBetween(accessed, at);
      if(age !== null && age > staleAfter) stale.push({ ...where, accessedAt: accessed, ageDays: age });
    }
  }
  // One page answering most of a dossier is worth a second look, and is the
  // "duplication" the Librarian is asked about.
  const leaned = [...uses.entries()]
    .filter(([, count]) => cited > 2 && count / cited >= RELIANCE_SHARE)
    .map(([url, count]) => ({ url, claimCount: count, ofCited: cited }));
  return {
    checkedAt: at,
    claimsWithSources: entries.filter(entry => (entry.claim?.sources || []).length).length,
    citationsChecked: cited,
    sourcesWithoutAuthority: withoutAuthority,
    sourcesWithoutAccessDate: withoutAccessDate,
    staleSources: stale,
    singleSourceReliance: leaned,
    // Said plainly, because this travels into a prompt and the agent reading it
    // must know what has and has not already been done.
    note: 'Counted rather than judged: whether a source names an authority, carries an access date, is older than a year, or is being made to answer most of the dossier. Nothing here says a source is wrong or inapplicable -- that is the reading still to be done.',
  };
}

/** Whether the counting found anything worth the Librarian's attention. */
function hasFindings(audit){
  return Boolean(audit && (audit.sourcesWithoutAuthority.length || audit.sourcesWithoutAccessDate.length
    || audit.staleSources.length || audit.singleSourceReliance.length));
}

module.exports = { STALE_AFTER_DAYS, RELIANCE_SHARE, claimsOf, daysBetween, auditSources, hasFindings };
