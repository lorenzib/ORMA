#!/usr/bin/env node
'use strict';

/**
 * Ask the dossier gate about a trail now, instead of pushing it there to find
 * out. Read-only: no model call, no write, and the outputs it reads are the
 * ones advancement would read.
 */

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {gateDryRun}=require('../workflows/gate-dry-run');

function parseArgs(argv){
  const args={trail:null};
  for(let index=0;index<argv.length;index+=1){
    const [key,inline]=String(argv[index]).replace(/^--/,'').split('=');
    if(key!=='trail')continue;
    args.trail=inline||argv[index+1]||null;
  }
  return args;
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

async function main(options={}){
  const args=parseArgs(options.argv||process.argv.slice(2));
  if(!args.trail)throw new Error('A trail is required: --trail <id>');
  const store=options.store||new FirestoreBackofficeStore();
  const [orchestration,jobs]=await Promise.all([
    store.getArtifact('trail-orchestration'),
    store.listJobs(['completed']),
  ]);
  const trail=(orchestration?.trails||[]).find(item=>
    String(item.trailId)===String(args.trail)||String(item.candidateId)===String(args.trail));
  // Only this trail's outputs are fetched, so the cost is its own jobs rather
  // than the catalogue's.
  const mine=(jobs||[]).filter(job=>trail&&job.candidateId===trail.candidateId);
  const outputs=new Map();
  for(const job of mine){
    const result=await store.getArtifact(`trail-specialist-output-${job.id}`);
    if(result)outputs.set(job.id,result);
  }
  return say(gateDryRun({orchestration,jobs:mine,outputFor:id=>outputs.get(id)||null,
    trailId:args.trail,at:options.at}));
}

if(require.main===module)main().catch(error=>{console.error(`[dry-run] ${error.message}`);process.exitCode=1;});

module.exports={parseArgs,main};
