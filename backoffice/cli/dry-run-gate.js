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
  // Every trail on the way, not a shortlist. With no budget to run anything,
  // the number worth knowing is how many of the whole pipeline can ever be
  // verified on the evidence already held -- that is what decides whether the
  // next top-up buys four trails or forty. --limit narrows it again.
  const args={trail:null,limit:Number.MAX_SAFE_INTEGER};
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
 * One trail's verdict in a few words, and never a contradictory few.
 *
 * It read `cannot: nothing unwaivable`, which is a sentence that argues with
 * itself. Three different situations were printing it: a trail the gate rejects
 * for a reason the report cannot see, a trail that simply has not been
 * researched yet, and a trail whose answered claim is being overruled. Six
 * trails came free on 15 October 2026 and every one of them read as `cannot`,
 * so the sweep said nothing had changed when a third of the blocked list had.
 *
 * The verdict a reader needs is whether spending money on this trail ends in a
 * seal, so each of the three says which it is.
 */
function verdictOf(report){
  if(report.wouldDecideWhenResearchEnds==='approve')return 'CAN be verified';
  if(report.overruledAnswers?.length)return `FAULT: answered, yet blocked by ${report.overruledAnswers.join(', ')}`;
  if(report.unwaivable.length)return `cannot: blocked by ${report.unwaivable.join(', ')}`;
  // Nothing unwaivable, and still not an approval. The gate is deciding on
  // something this report cannot see, which is worth naming rather than
  // printing as though the trail were refused.
  return `unclear: nothing unwaivable, yet ${report.wouldDecideWhenResearchEnds}`;
}

/**
 * One line per trail, so a sweep reads as a shortlist rather than as ten
 * reports. The trails with nothing unwaivable are the ones worth spending on,
 * and they are named at the end so the answer does not have to be assembled by
 * eye.
 */
function sayShortlist(reports){
  console.log(`[dry-run] ${reports.length} trail(s) on the way, asked what the gate would say.`);
  for(const report of reports){
    // One line each. Fifty trails over two lines apiece is a wall nobody reads.
    const verdict=verdictOf(report);
    console.log(`[dry-run]   ${String(report.state).padEnd(20)} ${verdict.padEnd(46)} ${report.trailName}`);
  }
  const clear=reports.filter(report=>!report.unwaivable.length);
  console.log(`[dry-run] ${clear.length} of ${reports.length} have nothing unwaivable standing.`);
  const approvable=clear.filter(report=>report.wouldDecide==='approve');
  if(approvable.length){
    console.log(`[dry-run] ${approvable.length} would be approved right now: ${approvable.map(report=>report.trailId).join(', ')}`);
  }else if(clear.length){
    console.log('[dry-run] None would be approved yet: each still has optional research the policy wants finished first.');
  }
  // The question worth asking when there is no budget to run anything.
  const eventual=reports.filter(report=>report.wouldDecideWhenResearchEnds==='approve');
  console.log(`[dry-run] ${eventual.length} of ${reports.length} would be approved once their research is over, on the evidence already held.`);
  if(eventual.length)console.log(`[dry-run]   ${eventual.map(report=>report.trailId).join(', ')}`);
  // What stands in the way of the rest, counted, so the next thing to fix is
  // the one blocking the most trails rather than the one most recently seen.
  const standing=new Map();
  for(const report of reports){
    if(report.wouldDecideWhenResearchEnds==='approve')continue;
    for(const id of report.unwaivable)standing.set(id,(standing.get(id)||0)+1);
  }
  if(standing.size){
    console.log('[dry-run] What stops the rest, most common first:');
    for(const [id,count] of [...standing.entries()].sort((a,b)=>b[1]-a[1])){
      console.log(`[dry-run]   ${String(count).padStart(3)}x ${id}`);
    }
  }
  // How much of the blocked list is ORMA arguing with itself rather than a walk
  // nobody wrote directions for. The two want completely different work.
  const faults=reports.filter(report=>report.overruledAnswers?.length);
  if(faults.length){
    console.log(`[dry-run] ${faults.length} of these are a FAULT, not a verdict: the claim is answered and still named as what blocks it.`);
    for(const report of faults){
      console.log(`[dry-run]   ${report.trailName}: ${report.overruledAnswers.join(', ')}`);
    }
  }
  const unclear=reports.filter(report=>!report.overruledAnswers?.length&&!report.unwaivable.length
    &&report.wouldDecideWhenResearchEnds!=='approve');
  if(unclear.length){
    console.log(`[dry-run] ${unclear.length} have nothing unwaivable and still would not be approved; the gate is reading something this report cannot see.`);
    for(const report of unclear){
      console.log(`[dry-run]   ${report.trailName}: ${String(report.note||'no reason given').slice(0,120)}`);
    }
  }
  console.log('[dry-run] That is a floor, not a forecast: more research can answer a claim, never add a blocker that is not already here.');
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
  if(report.overruledAnswers?.length){
    console.log(`[dry-run] FAULT — answered above, and still named as what decides against it: ${report.overruledAnswers.join(', ')}`);
    console.log('[dry-run] Two computations of one fact disagree. This is ORMA\u2019s bug, not a verdict on the walk.');
  }
  if(report.unwaivable.length){
    console.log(`[dry-run] Cannot be waived, so these decide it: ${report.unwaivable.join(', ')}`);
  }else{
    console.log('[dry-run] Nothing unwaivable stands. Everything left is optional detail.');
  }
  console.log(`[dry-run] ${report.waivableCount} optional blocker(s) the policy may accept as unknown.`);
  console.log(`[dry-run] The gate would: ${report.wouldDecide}${report.becauseOf?` → ${report.becauseOf}`:''}`);
  console.log(`[dry-run] Once the research is over, on this same evidence: ${report.wouldDecideWhenResearchEnds}`);
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
