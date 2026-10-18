#!/usr/bin/env node
'use strict';

// Read-only. Answers one question the per-state counts cannot: of the trails in
// the pipeline, which are being worked on and which have simply stopped.

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {buildFunnel}=require('../workflows/verification-funnel');
const fs=require('fs');
const path=require('path');

function readOverrides(){
  try{
    return JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../data/verified-trail-overrides.json'),'utf8'));
  }catch(error){
    // Reported rather than swallowed: an unreadable override file would make
    // every published trail vanish from this report, which reads as nothing
    // having been published.
    console.warn(`[funnel] could not read the override file: ${error.message}`);
    return null;
  }
}

function bar(count,width=28){
  return count?'#'.repeat(Math.max(1,Math.min(width,count))):'';
}

async function main(options={}){
  const store=options.store||new FirestoreBackofficeStore();
  const [orchestration,reviewQueue,jobs,editorialQueue,publicationStaging,publicationRequests]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.getArtifact('dossier-review-queue'),
    store.listJobs(['queued','running','ready-for-review','blocked']),
    // The half of the lane past the gate. A verified walk goes on through
    // these before it is on the page, and every one of them is a place it can
    // stop -- in states whose names read as patience.
    store.getArtifact('verified-trail-editorial-queue'),
    store.getArtifact('publication-staging'),
    store.getArtifact('publication-requests'),
  ]);
  // The end of the lane is a file in this repository, not an artifact: the
  // site is built from it, so it is the only thing that says a trail is out.
  const overrides=options.overrides||readOverrides();
  const report=buildFunnel({orchestration,jobs,reviewQueue,
    editorialQueue,publicationStaging,publicationRequests,overrides,nowMs:options.nowMs});
  console.log(JSON.stringify(report,null,2));

  console.log(`\n[funnel] ${report.totalTrails} trail(s) in the pipeline.`);
  for(const stage of report.stages){
    if(!stage.trails) { console.log(`[funnel] ${stage.state.padEnd(20)} 0`); continue; }
    const age=stage.oldestDaysInState===null?'':` · oldest ${stage.oldestDaysInState}d`;
    const stuck=stage.stalled?` · ${stage.stalled} stalled`:'';
    console.log(`[funnel] ${stage.state.padEnd(20)} ${String(stage.trails).padStart(3)} ${bar(stage.trails)}${age}${stuck}`);
  }

  const gate=report.dossierGate;
  console.log(`\n[funnel] ${gate.inState} trail(s) sit in dossier-human-gate: ${gate.genuine} completed a dossier, ${gate.viaAgentFailure} landed there by agent failure.`);
  // On the desk and approvable are not the same claim, and reporting only the
  // first as though it were the second is how a desk full of blocked dossiers
  // reads as a trail about to be verified.
  console.log(`[funnel] ${gate.itemsOnDesk} dossier decision(s) on the desk right now`
    + `, ${gate.readyToApprove} of them clean by every automated check.`);
  if(gate.pulledBackFromGate){
    // These trails did reach the finish line. Saying "none ever got there" from
    // a snapshot would be false, and would send someone to fix the wrong thing.
    console.log(`[funnel] ${gate.pulledBackFromGate} trail(s) were withdrawn from the dossier gate when the required route-guidance claims changed, and are re-earning them.`);
  }
  if(!gate.inRedTeamNow&&!gate.genuine){
    console.log('[funnel] Nothing is in red-team right now, so no new approvable dossier is close behind.');
  }
  if(report.stalled.total){
    console.log(`\n[funnel] ${report.stalled.total} trail(s) have no queued or running job and are not at a human gate.`);
    console.log('[funnel] These are stopped, not slow: no worker run will pick them up.');
    for(const [state,count] of report.stalled.byState) console.log(`[funnel]   ${state}: ${count}`);
  }
  if(report.terminal.length){
    console.log(`\n[funnel] ${report.terminal.length} trail(s) in a terminal state, named because a count cannot be acted on:`);
    for(const trail of report.terminal){
      const age=trail.daysInState===null?'':` · ${trail.daysInState}d`;
      const jobs=trail.pendingJobs?` · ${trail.pendingJobs} job(s) still queued`:' · no job owed';
      console.log(`[funnel]   ${trail.state} ${trail.candidateId}${age} · ${trail.attempts} attempt(s)${jobs}`);
      for(const blocker of trail.blockers) console.log(`[funnel]       ${blocker}`);
      if(!trail.blockers.length) console.log('[funnel]       (no blocker recorded)');
    }
  }
  const publication=report.publication;
  if(publication){
    console.log(`\n[funnel] Past the gate: this lane has published ${publication.reachedThePage} trail(s)`
      +`, ${publication.sealed} of them carrying the seal.`);
    console.log(`[funnel] ${publication.directionsOnThePage} trail page(s) carry directions, counting the ones written by hand.`);
    for(const stage of publication.stages){
      const held=stage.held?` · ${stage.held} held`:'';
      console.log(`[funnel] ${stage.stage.padEnd(22)} ${String(stage.trails).padStart(3)} ${bar(stage.trails)}${held}`);
    }
    if(publication.heldBy.length){
      // A trail held past the gate has already been verified. Whatever stops
      // it here is standing between finished work and a reader, so the reason
      // is printed, not the count.
      console.log(`\n[funnel] What is holding a verified trail off the page:`);
      for(const [reason,count] of publication.heldBy) console.log(`[funnel]   ${String(count).padStart(3)} × ${reason}`);
      for(const row of publication.held.slice(0,8)){
        console.log(`[funnel]   ${row.candidateId} at ${row.at}${row.state?` (${row.state})`:''}: ${row.holds.join('; ')}`);
      }
    } else if(!publication.reachedThePage){
      // Zero published and nothing held is the shape a lane that never ran
      // takes, and it reads identically to a lane with nothing to do.
      console.log('[funnel] Nothing is held and nothing is published: no trail has entered this half of the lane.');
    }
  } else {
    console.log('\n[funnel] The publication artifacts were not read, so nothing is said about what reached the page.');
  }

  console.log('\n[funnel] Nothing was changed.');
  return report;
}

if(require.main===module)main().catch(error=>{console.error(`[funnel] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
