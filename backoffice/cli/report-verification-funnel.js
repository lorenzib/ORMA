#!/usr/bin/env node
'use strict';

// Read-only. Answers one question the per-state counts cannot: of the trails in
// the pipeline, which are being worked on and which have simply stopped.

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {buildFunnel}=require('../workflows/verification-funnel');

function bar(count,width=28){
  return count?'#'.repeat(Math.max(1,Math.min(width,count))):'';
}

async function main(options={}){
  const store=options.store||new FirestoreBackofficeStore();
  const [orchestration,reviewQueue,jobs]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.getArtifact('dossier-review-queue'),
    store.listJobs(['queued','running','ready-for-review','blocked']),
  ]);
  const report=buildFunnel({orchestration,jobs,reviewQueue,nowMs:options.nowMs});
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
  console.log(`[funnel] ${gate.approvableItemsInQueue} approvable dossier decision(s) are on the desk right now.`);
  if(!gate.everReachedRedTeam&&!gate.genuine){
    // The finish line is not the constraint if nothing has ever approached it.
    console.log('[funnel] No trail has ever reached red-team, so none has ever produced an approvable dossier.');
  }
  if(report.stalled.total){
    console.log(`\n[funnel] ${report.stalled.total} trail(s) have no queued or running job and are not at a human gate.`);
    console.log('[funnel] These are stopped, not slow: no worker run will pick them up.');
    for(const [state,count] of report.stalled.byState) console.log(`[funnel]   ${state}: ${count}`);
  }
  console.log('\n[funnel] Nothing was changed.');
  return report;
}

if(require.main===module)main().catch(error=>{console.error(`[funnel] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
