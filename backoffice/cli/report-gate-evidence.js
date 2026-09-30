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
  if(geometry.externalId)line(`      source: ${geometry.externalId}`);
  const conformance=geometry.routeConformance;
  if(conformance){
    line(`      follows its route numbers: ${conformance.status}`
      +(conformance.offRouteKm!=null?` — off for ${conformance.offRouteKm} of ${conformance.distanceKm} km`:'')
      +(conformance.maxOffsetM!=null?`, up to ${conformance.maxOffsetM} m`:''));
  }else{
    line('      follows its route numbers: not measured (dossier predates the check)');
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

async function main(options={}){
  const store=options.store||new FirestoreBackofficeStore();
  const [orchestration,reviewQueue]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.getArtifact('dossier-review-queue'),
  ]);
  const report=buildGateEvidence({orchestration,reviewQueue,nowMs:options.nowMs});

  line(`${report.total} gate(s) awaiting you · ${report.readyToApprove} clean by every automated check`
    +` · ${report.notClearableHere} that no decision here can clear.`);

  let heading=null;
  for(const item of report.items){
    if(item.gateType!==heading){
      heading=item.gateType;
      console.log('');
      line(HEADINGS[heading]||heading.toUpperCase());
    }
    const age=item.waitingDays==null?'':` · waiting ${item.waitingDays}d`;
    line(`  ${item.approvalAllowed?'CLEAN ':'      '}${item.trailName} (${item.candidateId})${age}`);
    if(item.geometry)printGeometry(item.geometry);
    if(item.claims.length)printClaims(item.claims);
    for(const blocker of item.blockers){
      // Waivable is a statement about accepting a blocker at a gate that can be
      // approved. An agent failure is not such a gate, and labelling its
      // blocker waivable would read as an invitation to wave it through.
      const label=item.gateType==='agent-failure'?'needs a job'
        :blocker.waivable?'waivable  ':'UNWAIVABLE';
      line(`      ${label} ${blocker.reason.slice(0,110)}`);
    }
    if(item.approvalAllowed)line('      nothing is blocking this one.');
    else if(!item.blockers.length)line('      blocked, but the queue records no reason.');
  }

  console.log('');
  line('A waivable blocker is accepted with a written reason of at least ten characters.');
  line('An unwaivable one is route guidance: the directions printed for a walker, which no reason replaces.');
  line('Nothing was changed.');
  return report;
}

if(require.main===module)main().catch(error=>{console.error(`[evidence] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
