#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');const path=require('path');
const {loadProductionTrails}=require('../../scripts/load-production-trails');
const {planNewTrailScouting}=require('../workflows/plan-new-trail-scouting');

async function main(options={}){
  const root=options.root||path.resolve(__dirname,'..','..');
  const sources=await Promise.all([
    fs.readFile(path.join(root,'dog-friendly-routes.geojson'),'utf8').then(text=>({region:'dolomites',data:JSON.parse(text)})),
    fs.readFile(path.join(root,'dog-friendly-routes-savoy.geojson'),'utf8').then(text=>({region:'savoy',data:JSON.parse(text)})),
  ]);
  const packet=planNewTrailScouting(sources,loadProductionTrails(root),{at:options.at,limit:options.limit||25});
  const output=path.join(root,'backoffice-data','new-trail-scouting.json');await fs.writeFile(output,`${JSON.stringify(packet,null,2)}\n`,'utf8');
  console.log(`[new-trail-scouting] ${packet.summary.candidates} candidates; ${packet.summary.existingArea} expand an existing area.`);
  console.log('[new-trail-scouting] Candidates only. Nothing was added to the public trail catalogue.');return packet;
}
if(require.main===module)main().catch(error=>{console.error(`[new-trail-scouting] ${error.message}`);process.exitCode=1;});
module.exports={main};
