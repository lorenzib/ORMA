#!/usr/bin/env node
'use strict';

/**
 * Run the free seal checks for every catalogue trail and write
 * data/free-seal-checks.json. No model call, no Firestore read.
 *
 *   npm run backoffice:free-checks                 every trail
 *   npm run backoffice:free-checks -- --trail=osm-1,osm-2
 *   npm run backoffice:free-checks -- --limit=10 --delay-ms=2000
 *   npm run backoffice:free-checks -- --budget-minutes=100
 *
 * Trails never checked go first, then the longest since their last check, so
 * a run that stops at its time budget leaves the next one to carry on where it
 * stopped. Whatever was measured before the budget ran out is written.
 *
 * A lookup that fails keeps the last answer that worked, marked with when it
 * stopped refreshing: a service outage is not evidence about a trail.
 */

const fs=require('fs');
const path=require('path');
const {loadProductionTrails}=require('../../scripts/load-production-trails');
const {FREE_CHECKS_VERSION,FREE_CHECKS_FILE,freeSealChecksFor,natura2000Control,problemsIn,
  loadFreeSealChecks}=require('../workflows/free-seal-checks');

function option(name,fallback){
  const arg=process.argv.find(value=>value.startsWith(`--${name}=`));
  return arg?arg.slice(name.length+3):fallback;
}

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Never-checked trails first, then the oldest check; ties keep catalogue order. */
function inCheckingOrder(trails,previous){
  const lastChecked=trail=>previous?.trails?.[trail.id]?.checkedAt||'';
  return trails.map((trail,index)=>({trail,index}))
    .sort((a,b)=>lastChecked(a.trail).localeCompare(lastChecked(b.trail))||a.index-b.index)
    .map(({trail})=>trail);
}

/** Keep the last good answer for any step that failed this time. */
function mergedWithPrevious(next,previous,at){
  if(!previous)return next;
  const merged={...next};
  for(const step of ['communes','protectedAreas','photo']){
    // A remembered answer is only worth keeping if it was a real one: a
    // municipality list that is empty was a broken lookup, not an answer.
    const usable=previous[step]&&previous[step].status!=='lookup-failed'
      &&!(step==='communes'&&!(previous[step].communes||[]).length);
    if(next[step]?.status==='lookup-failed'&&usable){
      merged[step]={...previous[step],staleSince:previous[step].staleSince||at,lastError:next[step].error};
    }
  }
  return merged;
}

async function main(){
  const root=path.resolve(__dirname,'../..');
  const at=new Date().toISOString();
  const only=option('trail','')?new Set(option('trail','').split(',').map(id=>id.trim()).filter(Boolean)):null;
  const limit=Number(option('limit','0'))||Infinity;
  const delayMs=Number(option('delay-ms','1500'));
  const budgetMinutes=Number(option('budget-minutes','0'))||Infinity;
  const stopAt=Date.now()+budgetMinutes*60000;
  const previous=loadFreeSealChecks(root)||{trails:{}};
  const trails=inCheckingOrder(loadProductionTrails(root).filter(trail=>!only||only.has(trail.id)),previous).slice(0,limit);
  const routeSources=JSON.parse(fs.readFileSync(path.join(root,'data','route-sources.json'),'utf8')).sources||{};
  const control=await natura2000Control().catch(error=>({found:false,error:String(error.message||error)}));
  if(!control.found)console.warn(`EEA control site ${control.code||''} did not come back; protected areas are recorded as unchecked this run.`);

  const results={...(previous.trails||{})};
  let needsALook=0;let checked=0;
  for(const [index,trail] of trails.entries()){
    if(Date.now()>=stopAt){
      console.log(`\nTime budget of ${budgetMinutes} minutes reached; ${trails.length-index} trail(s) wait for the next run.`);
      break;
    }
    const entry=await freeSealChecksFor(trail,{at,control,routeSource:routeSources[trail.id]});
    results[trail.id]=mergedWithPrevious(entry,previous.trails?.[trail.id],at);
    const problems=problemsIn(results[trail.id]);
    if(problems.length)needsALook+=1;
    checked+=1;
    console.log(`${index+1}/${trails.length} ${trail.id} ${trail.name}${problems.length?`\n  - ${problems.join('\n  - ')}`:''}`);
    if(index<trails.length-1)await wait(delayMs);
  }

  const sorted=Object.fromEntries(Object.entries(results).sort(([a],[b])=>a.localeCompare(b)));
  const artifact={contractVersion:FREE_CHECKS_VERSION,generatedAt:at,
    note:'Free measurements behind the ORMA Verified seal: municipalities on the line (OpenStreetMap admin level 8), Natura 2000 sites it touches (EEA), its length against the recorded official distance, and where its photograph was taken. Written by npm run backoffice:free-checks; nothing here is a verification.',
    trails:sorted};
  fs.writeFileSync(path.join(root,FREE_CHECKS_FILE),`${JSON.stringify(artifact,null,2)}\n`);
  console.log(`\nChecked ${checked} of ${trails.length} trail(s); ${needsALook} need a look. Wrote ${FREE_CHECKS_FILE}.`);
}

if(require.main===module){
  main().catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={mergedWithPrevious,inCheckingOrder};
