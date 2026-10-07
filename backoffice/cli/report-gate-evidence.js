#!/usr/bin/env node
'use strict';

// Read-only. Prints what each waiting gate is actually asking, so the judgement
// can be made from the evidence rather than from twenty-three desk cards.

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {buildGateEvidence}=require('../workflows/gate-evidence');

const HEADINGS={
  'dossier-approval':'DOSSIER APPROVAL — approving one of these verifies a trail',
  'geometry-approval':'GEOMETRY APPROVAL — does the drawn line match the official route',
  'agent-failure':'AGENT FAILURE — no decision here clears these; the job has to run',
};

function line(text){console.log(`[evidence] ${text}`);}

function printGeometry(geometry){
  if(!geometry)return;
  const bits=[];
  if(geometry.distanceKm!=null){
    const official=geometry.officialDistanceKm!=null?` vs ${geometry.officialDistanceKm} km official`:'';
    const delta=geometry.distanceDeltaPercent!=null?` (${geometry.distanceDeltaPercent>0?'+':''}${geometry.distanceDeltaPercent}%)`:'';
    bits.push(`${geometry.distanceKm} km${official}${delta}`);
  }
  if(geometry.pointCount!=null)bits.push(`${geometry.pointCount} points`);
  if(geometry.isClosed!=null)bits.push(geometry.isClosed?'closes':`open by ${geometry.closureDistanceM} m`);
  if(geometry.maxSegmentM!=null)bits.push(`longest gap ${geometry.maxSegmentM} m`);
  if(geometry.components!=null)bits.push(`${geometry.components} component(s)`);
  if(bits.length)line(`      line: ${bits.join(' · ')}`);
  if(geometry.externalId){
    const version=geometry.relationVersion!=null?` v${geometry.relationVersion}`:'';
    const edited=geometry.relationTimestamp?`, last edited ${String(geometry.relationTimestamp).slice(0,10)}`:'';
    line(`      source: ${geometry.externalId}${version}${edited}`);
  }
  const conformance=geometry.routeConformance;
  if(conformance){
    line(`      follows its route numbers: ${conformance.status}`
      +(conformance.offRouteKm!=null?` — off for ${conformance.offRouteKm} of ${conformance.distanceKm} km`:'')
      +(conformance.maxOffsetM!=null?`, up to ${conformance.maxOffsetM} m`:''));
  }else{
    line('      follows its route numbers: not measured (dossier predates the check)');
  }
}

// Unwaivable blockers are always named in full: they are rare, and each one
// decides whether a gate can be approved at all. Everything else is counted by
// shape, because forty-one blockers on one dossier is not forty-one problems --
// printing them all is how a report becomes something nobody reads.
//
// 'needs a job' rather than 'waivable' on an agent failure: that gate cannot be
// approved at all, and the waivable label would read as an invitation.
function printBlockers(item,full){
  const blockers=item.blockers;
  if(!blockers.length)return;
  if(item.gateType==='agent-failure'){
    line(`      needs a job · ${blockers[0].reason.slice(0,100)}`);
    if(blockers.length>1)line(`      and ${blockers.length-1} more, all waiting on the same run`);
    return;
  }
  for(const blocker of blockers.filter(entry=>!entry.waivable)){
    line(`      UNWAIVABLE ${blocker.reason.slice(0,110)}`);
  }
  const waivable=blockers.filter(entry=>entry.waivable).length;
  if(waivable)line(`      ${waivable} blocker(s) a written reason can answer:`);
  for(const bucket of item.blockerSummary){
    // A geometry gate's blockers are bare codes -- not-closed-loop,
    // official-distance-conflict -- short, few, and the whole content of the
    // question. Counting those says nothing; the agents' prose is what needed
    // summarising.
    if(bucket.agent==='(unattributed)'){
      for(const reason of bucket.reasons)line(`        ${reason.slice(0,100)}`);
      continue;
    }
    const parts=[];
    if(bucket.verdict)parts.push(`says ${bucket.verdict}`);
    if(bucket.openQuestions)parts.push(`${bucket.openQuestions} open question(s)`);
    if(bucket.claimStatuses.length)parts.push(bucket.claimStatuses.join(', '));
    line(`        ${String(bucket.total).padStart(3)}  ${bucket.agent}${parts.length?` — ${parts.join('; ')}`:''}`);
  }
  if(full){
    line('      every blocker, in full:');
    for(const blocker of blockers)line(`        ${blocker.reason}`);
  }
}

function printClaims(claims){
  if(!claims.length)return;
  const unsupported=claims.filter(claim=>claim.finding!=='supported-proposal');
  line(`      claims: ${claims.length} proposed, ${claims.length-unsupported.length} supported`);
  for(const claim of unsupported.slice(0,6)){
    line(`        ${claim.agentId}/${claim.id}: ${claim.finding}`
      +(claim.blockers.length?` — ${String(claim.blockers[0]).slice(0,80)}`:''));
  }
}

/**
 * How the list divides before any of it is read: what the sources disagree
 * about, against what no source was found for.
 *
 * This is the line that says whether a sitting is worth having. Forty blockers
 * of which three are contested is three decisions and a research backlog; forty
 * of which none are is not a decision at all, and the gate is waiting on an
 * agent. The contested ones are named, because there are few enough to name and
 * they are the reason to open the card.
 */
function printDisposition(item){
  const split=item.disposition;
  if(!split||!(split.contested+split.unresearched+split.undetermined))return;
  const parts=[`${split.contested} contested`,`${split.unresearched} unresearched`];
  if(split.undetermined)parts.push(`${split.undetermined} unclassified`);
  line(`      ${parts.join(' · ')}`);
  if(!split.contested&&split.unresearched){
    line('      nothing here is contested — no source was found for any of it, so this is a question for the agent');
    return;
  }
  if(!split.contested){
    // All unclassified. Saying "no source was found" here would be a claim
    // about evidence nobody made: these name no agent or no claim, so what is
    // true is only that the classifier could not place them. Measured on
    // osm-14381930 (La Plagne), which is exactly this case.
    line('      none of this is classified — it names no agent or claim, so it is yours to read');
    return;
  }
  for(const reason of split.contestedReasons.slice(0,6))line(`        CONTESTED ${reason.slice(0,100)}`);
}

/** One trail's blockers in full, for the sitting where they are actually weighed. */
function focusFrom(argv){
  const only=argv.find(arg=>arg.startsWith('--trail='));
  return {full:argv.includes('--full')||!!only,only:only?only.split('=')[1]:null};
}

async function main(options={}){
  const store=options.store||new FirestoreBackofficeStore();
  const focus=options.focus||focusFrom(process.argv.slice(2));
  const [orchestration,reviewQueue]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.getArtifact('dossier-review-queue'),
  ]);
  const report=buildGateEvidence({orchestration,reviewQueue,nowMs:options.nowMs});

  line(`${report.total} gate(s) awaiting you · ${report.readyToApprove} clean by every automated check`
    +` · ${report.notClearableHere} that no decision here can clear.`);
  // Which kind, because the two need opposite things: a job has to run, or an
  // agent has to supply directions. A bare count reads as "nothing to do here"
  // when one of them is a revision waiting to be requested.
  const {agentFailure,routeGuidanceMissing}=report.notClearable;
  if(agentFailure||routeGuidanceMissing){
    const parts=[];
    if(routeGuidanceMissing)parts.push(`${routeGuidanceMissing} waiting on route guidance only logistics can supply`);
    if(agentFailure)parts.push(`${agentFailure} waiting on a job that has to run`);
    line(`  of those: ${parts.join(' · ')}`);
  }

  const shown=focus.only?report.items.filter(entry=>entry.candidateId===focus.only):report.items;
  if(focus.only&&!shown.length)line(`No gate is waiting for ${focus.only}.`);
  const full=focus.full;

  let heading=null;
  for(const item of shown){
    if(item.gateType!==heading){
      heading=item.gateType;
      console.log('');
      line(HEADINGS[heading]||heading.toUpperCase());
    }
    const age=item.waitingDays==null?'':` · waiting ${item.waitingDays}d`;
    line(`  ${item.approvalAllowed?'CLEAN ':'      '}${item.trailName} (${item.candidateId})${age}`);
    // Said before the blockers, because it changes what the list below is: not
    // the decision, but as much of it as the queue had room to keep.
    if(item.ballotAbridged)line('      the queue shortened this list to fit, so an approval here would be refused');
    printDisposition(item);
    if(item.geometry)printGeometry(item.geometry);
    if(item.claims.length)printClaims(item.claims);
    printBlockers(item,full);
    if(item.approvalAllowed)line('      nothing is blocking this one.');
    else if(!item.blockers.length)line('      blocked, but the queue records no reason.');
  }

  console.log('');
  if(!full)line('Run with --trail=<id> to read one trail\'s blockers in full before accepting them.');
  line('A waivable blocker is accepted with a written reason of at least ten characters.');
  line('An unwaivable one is route guidance: the directions printed for a walker, which no reason replaces.');
  line('Nothing was changed.');
  return report;
}

if(require.main===module)main().catch(error=>{console.error(`[evidence] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
