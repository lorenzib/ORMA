'use strict';

// What a moderator needs in front of her to answer a gate, rather than the
// counts that say how many are waiting.
//
// The state report says 23 await you and the funnel says where they sit;
// neither names a trail. Opening twenty-three desk cards to find out which
// three are one click and which ten cannot be cleared at all is the work this
// replaces. Read-only: it reads the queue and reports, and decides nothing.

const {waivableBlocker,currentBlockingReasons}=require('./compile-verified-dossier');
const {classifyBlocker,blockerDisposition}=require('../blocker-kinds');

// Ordered by what is worth doing first, not alphabetically. A dossier approval
// is a trail verified; a clean geometry gate is one click; a blocked geometry
// gate is real judgement; an agent failure cannot be cleared by any decision
// here at all, and belongs last so it is not mistaken for work.
const GATE_ORDER=['dossier-approval','geometry-approval','agent-failure'];

function daysSince(iso,nowMs){
  const at=Date.parse(iso||'');
  return Number.isFinite(at)?Math.floor((nowMs-at)/86400000):null;
}

/** The cartographer's own numbers, which are what a geometry gate is asking about. */
function geometryEvidence(outputs){
  const result=(outputs||[]).find(output=>output.agentId==='cartographer')?.result;
  if(!result)return null;
  const assessment=result.assessment||{};
  const comparison=result.comparison||{};
  return {
    distanceKm:assessment.distanceKm??null,
    officialDistanceKm:comparison.officialDistanceKm??null,
    distanceDeltaPercent:comparison.distanceDeltaPercent??null,
    withinOfficialDistanceTolerance:comparison.withinOfficialDistanceTolerance??null,
    isClosed:assessment.isClosed??null,
    closureDistanceM:assessment.closureDistanceM??null,
    maxSegmentM:assessment.maxSegmentM??null,
    pointCount:assessment.pointCount??null,
    issues:assessment.issues||[],
    components:Array.isArray(result.components)?result.components.length:null,
    externalId:result.source?.externalId||null,
    // Which version of the relation the line was built from. A line is only as
    // current as its source, and the cartographer already records this -- so
    // saying it costs nothing, where finding it out later costs an API call per
    // trail at the moment somebody is trying to decide.
    relationVersion:result.source?.relationVersion??result.relation?.version??null,
    relationTimestamp:result.source?.relationTimestamp||result.relation?.timestamp||null,
    // Added by #456. Absent on every dossier captured before it existed, and
    // absent is not the same as clean.
    routeConformance:result.routeConformance||null,
    instructions:result.humanGate?.instructions||[],
  };
}

/** Every claim a specialist proposed, and whether it is supported. */
function claimEvidence(outputs){
  const claims=[];
  for(const output of outputs||[]){
    for(const claim of output.result?.claims||[]){
      claims.push({agentId:output.agentId,id:claim.id,finding:claim.finding,
        proposedValue:typeof claim.proposedValue==='string'?claim.proposedValue:null,
        blockers:claim.blockers||[],sources:(claim.sources||[]).length});
    }
  }
  return claims;
}

// Forty-one blockers on one dossier is not forty-one problems. They arrive in
// four recognisable shapes, and only two of them are things a moderator weighs:
//
//   regulatoryRanger: recommendation is block          the agent's own verdict
//   terrainPoi: open question — Can a field visit...   research nobody could close
//   terrainPoi/livestock: unresolved                   a claim's standing
//   terrainPoi/livestock: No parcel-level record...    why it is unresolved
//
// Counting them by shape says what the sitting is: mostly open questions means
// the evidence is thin, several conflicted claims means the sources disagree,
// and those want different judgements.
//
// The taxonomy itself lives in backoffice/blocker-kinds.js, which the desk and
// the dispatch target read too. It was duplicated here for one commit; a second
// hand-maintained copy of a rule about blocker wording is precisely how the
// route-guidance regex went stale for nineteen days.

function summariseBlockers(blockers){
  const byAgent=new Map();
  for(const entry of blockers){
    const shape=classifyBlocker(entry.reason);
    if(!byAgent.has(shape.agent))byAgent.set(shape.agent,{agent:shape.agent,total:0,openQuestions:0,claimStatuses:[],verdict:null,reasons:[]});
    const bucket=byAgent.get(shape.agent);
    bucket.reasons.push(entry.reason);
    bucket.total+=1;
    if(shape.kind==='open-question')bucket.openQuestions+=1;
    if(shape.kind==='claim-status')bucket.claimStatuses.push(`${shape.claim} ${shape.finding}`);
    if(shape.kind==='verdict')bucket.verdict=shape.recommendation||null;
  }
  return [...byAgent.values()].sort((a,b)=>b.total-a.total);
}

function describeItem(item,trail,nowMs){
  // The list a decision will be weighed against, recomputed from the outputs
  // attached to the gate -- not the copy stored when it opened. Reporting the
  // stored copy is how "41 blockers" came to be printed for seven different
  // dossiers: that was the compaction cap, 40 reasons plus a summary line, and
  // not a count of anything. currentBlockingReasons falls back to the stored
  // list where there are no outputs to re-read.
  const reasons=currentBlockingReasons(item).map(reason=>({
    reason:String(reason),
    // Route guidance is the one the dossier will not let a reason wave through:
    // it is the directions printed for a walker to follow.
    waivable:waivableBlocker(reason),
  }));
  return {
    trailName:item.trailName||item.trailId||item.candidateId||'(unnamed)',
    candidateId:item.candidateId||item.trailId||null,
    gateType:item.gateType||'(unknown)',
    approvalAllowed:item.approvalAllowed===true,
    waitingDays:daysSince(item.openedAt,nowMs),
    allowedActions:item.allowedActions||[],
    blockers:reasons,
    unwaivable:reasons.filter(entry=>!entry.waivable).length,
    // The queue had to abridge this gate's ballot to fit its budget, so the
    // desk cannot show every box an approval needs ticked. Worth saying: the
    // decision is not available until the queue has room again.
    ballotAbridged:item.blockingReasonsAbridged===true,
    // How the list divides: what the sources disagree about, which she can
    // settle, against what no source was found for, which she cannot. A gate
    // with nothing contested is not waiting on a decision at all.
    disposition:(()=>{
      const {contested,unresearched,undetermined}=blockerDisposition(reasons.map(entry=>entry.reason));
      return {contested:contested.length,unresearched:unresearched.length,
        undetermined:undetermined.length,contestedReasons:contested};
    })(),
    state:trail?.state||null,
    stage:trail?.stage||null,
    baselineBlockers:item.sourceTrail?.baselineBlockers||[],
    geometry:item.gateType==='geometry-approval'?geometryEvidence(item.specialistOutputs):null,
    claims:item.gateType==='dossier-approval'?claimEvidence(item.specialistOutputs):[],
    blockerSummary:summariseBlockers(reasons),
  };
}

function buildGateEvidence({orchestration,reviewQueue,nowMs=Date.now()}){
  const trails=new Map((orchestration?.trails||[]).map(trail=>[trail.candidateId||trail.trailId,trail]));
  const waiting=(reviewQueue?.items||[]).filter(item=>item.state==='awaiting-human');
  const described=waiting.map(item=>describeItem(item,trails.get(item.candidateId||item.trailId),nowMs));
  const rank=gate=>{const index=GATE_ORDER.indexOf(gate);return index===-1?GATE_ORDER.length:index;};
  described.sort((a,b)=>
    rank(a.gateType)-rank(b.gateType)
    // Clean first inside a gate: those are the ones that cost a click.
    ||(b.approvalAllowed?1:0)-(a.approvalAllowed?1:0)
    ||(b.waitingDays??-1)-(a.waitingDays??-1));
  return {
    total:described.length,
    readyToApprove:described.filter(entry=>entry.approvalAllowed).length,
    // No decision at this gate clears an agent failure; the job has to run.
    notClearableHere:described.filter(entry=>entry.gateType==='agent-failure').length,
    items:described,
  };
}

module.exports={buildGateEvidence,describeItem,geometryEvidence,claimEvidence,classifyBlocker,summariseBlockers,GATE_ORDER};
