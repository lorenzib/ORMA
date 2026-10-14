#!/usr/bin/env node
'use strict';

/**
 * Ask the dossier gate about a trail now, instead of pushing it there to find
 * out. Read-only: no model call, no write, and the outputs it reads are the
 * ones advancement would read.
 */

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {gateDryRun}=require('../workflows/gate-dry-run');
const {closestToVerified}=require('../workflows/closest-to-verified');
const {loadProductionTrails}=require('../../scripts/load-production-trails');
const path=require('path');

function parseArgs(argv){
  const args={trail:null,limit:10};
  for(let index=0;index<argv.length;index+=1){
    const [key,inline]=String(argv[index]).replace(/^--/,'').split('=');
    const value=inline||argv[index+1];
    if(key==='trail')args.trail=value||null;
    if(key==='limit'){
      const parsed=Number.parseInt(value,10);
      if(Number.isInteger(parsed)&&parsed>0)args.limit=parsed;
    }
  }
  return args;
}

/**
 * One line per trail, so a sweep reads as a shortlist rather than as ten
 * reports. The trails with nothing unwaivable are the ones worth spending on,
 * and they are named at the end so the answer does not have to be assembled by
 * eye.
 */
function sayShortlist(reports){
  console.log(`[dry-run] ${reports.length} trail(s) nearest the seal, asked what the gate would say.`);
  for(const report of reports){
    const stands=report.unwaivable.length
      ? `blocked by ${report.unwaivable.join(', ')}`
      : 'nothing unwaivable';
    console.log(`[dry-run]   ${String(report.state).padEnd(20)} ${report.trailName}`);
    console.log(`[dry-run]   ${' '.repeat(20)} ${stands} · would ${report.wouldDecide}`);
  }
  const clear=reports.filter(report=>!report.unwaivable.length);
  console.log(`[dry-run] ${clear.length} of ${reports.length} have nothing unwaivable standing${clear.length?`: ${clear.map(report=>report.trailId).join(', ')}`:''}`);
  const approvable=clear.filter(report=>report.wouldDecide==='approve');
  if(approvable.length){
    console.log(`[dry-run] ${approvable.length} would be approved right now: ${approvable.map(report=>report.trailId).join(', ')}`);
  }else if(clear.length){
    console.log('[dry-run] None would be approved yet: each still has optional research the policy wants finished first.');
  }
  console.log('[dry-run] Read-only. Nothing was changed.');
  return reports;
}

function say(report){
  if(!report.found){
    console.log(`[dry-run] No orchestrated trail for "${report.trailId}".`);
    return report;
  }
  console.log(`[dry-run] ${report.trailName} · ${report.state} · ${report.blockerCount} blocker(s) as the gate would count them.`);
  console.log(`[dry-run] Agents reporting: ${report.agentsReporting.join(', ')||'none'}`);
  if(report.missingAgents.length){
    console.log(`[dry-run] Not yet reporting: ${report.missingAgents.join(', ')} — advancement waits for one completed job from each.`);
  }
  console.log('[dry-run] The four directions, and where each answer comes from:');
  for(const claim of report.routeGuidance){
    const name=claim.claimId.padEnd(22);
    if(!claim.answered){ console.log(`[dry-run]   ${name} NOT ANSWERED`); continue; }
    const who=claim.authority?` · ${claim.authority}`:'';
    console.log(`[dry-run]   ${name} answered by ${claim.from}${who}`);
  }
  if(report.unwaivable.length){
    console.log(`[dry-run] Cannot be waived, so these decide it: ${report.unwaivable.join(', ')}`);
  }else{
    console.log('[dry-run] Nothing unwaivable stands. Everything left is optional detail.');
  }
  console.log(`[dry-run] ${report.waivableCount} optional blocker(s) the policy may accept as unknown.`);
  console.log(`[dry-run] The gate would: ${report.wouldDecide}${report.becauseOf?` → ${report.becauseOf}`:''}`);
  if(report.note)console.log(`[dry-run] Reason: ${String(report.note).slice(0,300)}`);
  console.log('[dry-run] Read-only. Nothing was changed.');
  return report;
}

/** One trail's verdict, reading only that trail's own outputs. */
async function dryRunOne(store,orchestration,jobs,trailId,at,catalogue){
  const trail=(orchestration?.trails||[]).find(item=>
    String(item.trailId)===String(trailId)||String(item.candidateId)===String(trailId));
  const mine=(jobs||[]).filter(job=>trail&&job.candidateId===trail.candidateId);
  const outputs=new Map();
  for(const job of mine){
    const result=await store.getArtifact(`trail-specialist-output-${job.id}`);
    if(result)outputs.set(job.id,result);
  }
  return gateDryRun({orchestration,jobs:mine,outputFor:id=>outputs.get(id)||null,trailId,at,
    // The catalogue as it stands, not as the last audit recorded it.
    trail:catalogue?.get(String(trail?.trailId))||catalogue?.get(String(trail?.candidateId))||null});
}

async function main(options={}){
  const args=parseArgs(options.argv||process.argv.slice(2));
  const store=options.store||new FirestoreBackofficeStore();
  const [orchestration,jobs]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.listJobs(['completed']),
  ]);
  // Read once and shared, so a sweep of ten does not read the catalogue ten
  // times. Absent is not fatal: without it ORMA's own record simply cannot
  // answer, which is what the report then says.
  let catalogue=null;
  try{ catalogue=new Map(loadProductionTrails(path.resolve(__dirname,'../..')).map(trail=>[String(trail.id),trail])); }
  catch(error){ console.log(`[dry-run] Could not read the trail catalogue (${error.message}); ORMA's own record will not answer.`); }
  if(args.trail)return say(await dryRunOne(store,orchestration,jobs,args.trail,options.at,catalogue));
  // No trail named: sweep the ones nearest the seal, which is the question
  // worth asking before spending anything -- who is close, and who is blocked
  // by something no amount of research will clear.
  const nearest=closestToVerified(orchestration,{limit:args.limit}).nearest;
  const reports=[];
  for(const row of nearest){
    reports.push(await dryRunOne(store,orchestration,jobs,row.trailId,options.at,catalogue));
  }
  return sayShortlist(reports.filter(report=>report.found));
}

if(require.main===module)main().catch(error=>{console.error(`[dry-run] ${error.message}`);process.exitCode=1;});

module.exports={parseArgs,sayShortlist,dryRunOne,main};
