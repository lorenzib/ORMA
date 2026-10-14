#!/usr/bin/env node
'use strict';

/**
 * The verification state, read from a laptop.
 *
 * Every backoffice report needs the Firestore service account, which lives in
 * GitHub Actions and nowhere else, so `npm run backoffice:closest` on a laptop
 * fails with `Could not load the default credentials` and says nothing about
 * trails. That is the correct secret boundary and not worth moving.
 *
 * So this runs the report where the credentials already are: it dispatches the
 * read-only verification-state workflow, waits for it, and prints the lines
 * back. Nothing is written and no model is called; the cost is the Firestore
 * reads that report already makes.
 */

const {spawnSync}=require('child_process');
const WORKFLOW='orma-verification-state.yml';
// The reports the workflow runs, by the prefix each one tags its lines with.
const SECTIONS={closest:'closest',yield:'yield',funnel:'funnel',state:'report',evidence:'evidence',
  // What the gate would say about a named trail, asked now rather than waited for.
  gate:'dry-run',progress:'progress'};

function gh(args,{quiet=false}={}){
  const result=spawnSync('gh',args,{encoding:'utf8'});
  if(result.error&&result.error.code==='ENOENT'){
    throw new Error('The GitHub CLI (gh) is required: https://cli.github.com');
  }
  if(result.status!==0&&!quiet){
    throw new Error(`gh ${args.slice(0,2).join(' ')} failed: ${(result.stderr||'').trim()}`);
  }
  return (result.stdout||'').trim();
}

function parseArgs(argv){
  const args={section:'closest',trail:null};
  for(const token of argv){
    const [key,value]=token.replace(/^--/,'').split('=');
    if(key==='trail'&&value)args.trail=value;
    if(key==='section'&&value)args.section=value;
    if(key==='all')args.section='all';
  }
  return args;
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv);
  const run=['workflow','run',WORKFLOW,'--ref','main'];
  if(args.trail)run.push('-f',`trail=${args.trail}`);
  gh(run);
  console.log('[state] asked GitHub to read the pipeline; this takes about a minute.');
  // The dispatch does not return the run id, and the id only appears once the
  // run is registered, so the newest run is polled for rather than assumed.
  let runId=null;
  for(let attempt=0;attempt<12&&!runId;attempt+=1){
    await wait(5000);
    runId=gh(['run','list','--workflow',WORKFLOW,'--limit','1','--json','databaseId','-q','.[0].databaseId'],{quiet:true})||null;
  }
  if(!runId)throw new Error('The run did not appear. Check the Actions tab.');
  for(let attempt=0;attempt<60;attempt+=1){
    const status=gh(['run','view',runId,'--json','status','-q','.status'],{quiet:true});
    if(status==='completed')break;
    await wait(10000);
  }
  // The log is fetched whatever the conclusion: the trail-scoped step exits 1
  // when a trail has not reached the gate, which is an answer, not a failure.
  const log=gh(['run','view',runId,'--log'],{quiet:true});
  const lines=log.split('\n').map(line=>line.replace(/^[^Z]*Z[\t ]*/,''));
  const prefixes=args.section==='all'?Object.values(SECTIONS):[SECTIONS[args.section]||args.section];
  const wanted=lines.filter(line=>prefixes.some(prefix=>line.startsWith(`[${prefix}]`)));
  if(!wanted.length){
    console.log(`[state] the run finished but printed no ${prefixes.join('/')} lines.`);
    console.log(`[state] full log: gh run view ${runId} --log`);
    return;
  }
  console.log(wanted.join('\n'));
}

if(require.main===module)main().catch(error=>{console.error(`[state] ${error.message}`);process.exitCode=1;});

module.exports={parseArgs,SECTIONS,WORKFLOW};
