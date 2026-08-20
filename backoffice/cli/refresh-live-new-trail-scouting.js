#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {loadProductionTrails}=require('../../scripts/load-production-trails');
const {refreshLiveNewTrailScouting}=require('../workflows/refresh-live-new-trail-scouting');

async function sources(root){return Promise.all([
  fs.readFile(path.join(root,'dog-friendly-routes.geojson'),'utf8').then(text=>({region:'dolomites',data:JSON.parse(text)})),
  fs.readFile(path.join(root,'dog-friendly-routes-savoy.geojson'),'utf8').then(text=>({region:'savoy',data:JSON.parse(text)})),
]);}
function workflowRunUrl(env){return env.GITHUB_RUN_ID&&env.GITHUB_REPOSITORY?`${env.GITHUB_SERVER_URL||'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`:null;}
async function main(options={}){
  const root=options.root||path.resolve(__dirname,'../..');const env=options.env||process.env;const store=options.store||new FirestoreBackofficeStore();
  const result=await refreshLiveNewTrailScouting(store,await sources(root),loadProductionTrails(root),{at:options.at,limit:25,
    runId:env.GITHUB_RUN_ID||null,workflowRunUrl:workflowRunUrl(env),trigger:env.GITHUB_EVENT_NAME||'manual'});
  console.log(`[new-trail-scouting-live] ${result.packet.summary.candidates} protected candidates; ${result.packet.summary.existingArea} expand an existing area.`);
  console.log('[new-trail-scouting-live] Awaiting moderator selection. Nothing was published.');return result;
}
if(require.main===module)main().catch(error=>{console.error(`[new-trail-scouting-live] ${error.stack||error.message}`);process.exitCode=1;});
module.exports={sources,workflowRunUrl,main};
