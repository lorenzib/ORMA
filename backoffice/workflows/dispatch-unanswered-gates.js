'use strict';

// Ask the agent, instead of parking the question in front of someone who
// cannot answer it.
//
// A trail arrives at a human gate carrying blockers. Some of those are real
// decisions -- waive this, reject that -- and some are simply research nobody
// has done: a start point no source has been read for, a route sequence no
// agent has gone looking for. The desk already knows the difference, because
// `agentFromBlockers` can name the one specialist a set of blockers belongs to.
// Until now that rule only ran when the moderator clicked "request revision", so a
// gate whose blockers only Logistics can clear waited for a person who cannot
// clear them either. Seven dossier gates stood that way for eleven days.
//
// This pass closes that loop. It never approves and never rejects -- the gate
// decision stays hers. It only sends a question to whoever can answer it, under
// the current output contract, which is the thing that was missing: nothing
// re-runs an agent on a trail sitting at a human gate.
//
// Deliberately conservative. It only ever requests a revision, only on the two
// gate types the revision path handles, never past the resolution-attempt
// limit, never over a decision already waiting to be applied, and never more
// than a handful per pass -- each dispatch costs a model call on a metered
// account.
//
// It asks one agent at a time. The first cut dispatched only when the blockers
// named exactly one agent, and on the live queue that was none of them: all
// seven dossier gates carried findings from four or five agents at once, so the
// pass asked nobody anything. A revision carries one targetAgent, so a
// multi-agent gate is asked heaviest-load-first and returns with the rest,
// converging over passes. A gate whose blockers name no agent at all is still
// held -- that is a decision, not a dispatch.

const {dominantAgentFromBlockers,blockerCountsByAgent,blockersForAgent,geometryConflictBlockers}=require('../revision-target');
const {MAX_AUTOMATED_ATTEMPTS}=require('../contracts/resolution-policy-v1');

// The gates whose revision path apply-dossier-review implements. An
// 'agent-failure' gate is a different problem with its own machinery
// (requeue-fixed-jobs, retire-blocked-jobs); dispatching a revision there would
// ask an agent to redo work that never ran.
const DISPATCHABLE_GATES=Object.freeze(['dossier-approval','geometry-approval']);

// Past the automated-resolution limit apply-dossier-review stops queueing and
// marks the trail blocked instead. That is a reasonable end for a human who
// decided to keep trying, and a bad one for automation -- a machine must not be
// the thing that quietly retires her trail. At the limit this holds the gate
// and leaves it visible on the desk. Read from the policy contract rather than
// typed again here, so the two cannot drift apart.
const RESOLUTION_ATTEMPT_LIMIT=MAX_AUTOMATED_ATTEMPTS;

const DEFAULT_LIMIT=3;
const MAX_LISTED_REASONS=12;

/**
 * The instruction the agent receives. It has to say three things: that this
 * came from automation rather than from a moderator, what is outstanding, and
 * that the point is to re-run under today's contract -- the seven stale gates
 * held logistics output captured before the route-guidance claims existed, so
 * "try again" without that is an invitation to return the same dossier.
 */
function dispatchNote(targetAgent,reasons,alsoOutstanding){
  const outstanding=(reasons||[]).slice(0,MAX_LISTED_REASONS).map(reason=>`- ${String(reason).trim()}`);
  const shared=(alsoOutstanding||[]).filter(agent=>agent!==targetAgent);
  return [
    `ORMA automation: this gate has been standing with findings only ${targetAgent} can supply, so it is being`,
    'asked rather than left for a moderator who cannot supply them.',
    '',
    'Re-run this check under the current output contract and return every item below with a citable source.',
    'Where a source genuinely does not exist, say so explicitly in the claim rather than omitting it — an',
    'absent claim reads as work not done and returns the trail here unchanged.',
    '',
    // The gate usually holds several agents' findings. Listing only this
    // agent's share keeps it from answering for work that is not its own, and
    // naming the others keeps it from assuming the gate clears when it is done.
    ...(shared.length?[`Other findings on this gate belong to ${shared.join(', ')} and are being asked separately.`,'']:[]),
    'Outstanding:',
    ...outstanding,
  ].join('\n');
}

/**
 * Pure: what this pass would dispatch, and what it is deliberately leaving
 * alone. `held` exists so the reason a gate was not dispatched is reportable
 * rather than inferred from its absence.
 */
function planGateDispatches(orchestration,reviewQueue,options={}){
  const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:DEFAULT_LIMIT;
  const queued=new Set((options.queuedReviewIds||[]).map(id=>String(id)));
  const trails=new Map((orchestration?.trails||[]).map(trail=>[String(trail.candidateId),trail]));
  const dispatches=[],held=[];
  const hold=(item,reason)=>held.push({reviewId:item.reviewId,candidateId:item.candidateId,reason});

  for(const item of reviewQueue?.items||[]){
    if(item.state!=='awaiting-human')continue;
    if(!DISPATCHABLE_GATES.includes(item.gateType)){hold(item,'gate-type-has-its-own-recovery');continue;}
    // A decision already waiting to be applied -- hers, or one of this pass's
    // own from an earlier run -- owns this gate. Submitting over it would
    // either duplicate the dispatch or race her click.
    if(queued.has(String(item.reviewId))){hold(item,'decision-already-queued');continue;}
    const trail=trails.get(String(item.candidateId));
    if(!trail){hold(item,'trail-not-in-orchestration');continue;}
    // The queue item is the durable record and the trail is the live state; if
    // the trail has already moved off its gate, the item is stale.
    if(!String(trail.state||'').endsWith('-human-gate')){hold(item,'trail-no-longer-at-a-gate');continue;}
    const targetAgent=dominantAgentFromBlockers(item.blockingReasons);
    if(!targetAgent){hold(item,'blockers-name-no-agent');continue;}
    if((trail.resolutionAttempts?.[targetAgent]||0)>=RESOLUTION_ATTEMPT_LIMIT){hold(item,'resolution-attempts-exhausted');continue;}
    const outstandingAgents=[...blockerCountsByAgent(item.blockingReasons).keys()];
    // A geometry conflict is the cartographer's to settle, but the agents file
    // it under evidenceLibrarian/redTeam claim ids, so blockersForAgent finds
    // nothing prefixed 'cartographer'. Scope the note to the geometry blockers
    // that routed it here, rather than falling back to every agent's findings.
    let mine=blockersForAgent(item.blockingReasons,targetAgent);
    if(!mine.length&&targetAgent==='cartographer')mine=geometryConflictBlockers(item.blockingReasons);
    dispatches.push({reviewId:item.reviewId,candidateId:item.candidateId,trailName:item.trailName||trail.trailName||null,
      gateType:item.gateType,targetAgent,blockingReasons:item.blockingReasons||[],
      outstandingAgents,agentBlockingReasons:mine,
      note:dispatchNote(targetAgent,mine.length?mine:item.blockingReasons,outstandingAgents)});
  }

  return {dispatches:dispatches.slice(0,limit),held,deferred:Math.max(0,dispatches.length-limit)};
}

module.exports={DISPATCHABLE_GATES,RESOLUTION_ATTEMPT_LIMIT,DEFAULT_LIMIT,dispatchNote,planGateDispatches};
