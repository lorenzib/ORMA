#!/usr/bin/env node
'use strict';

const fs=require('fs/promises');const path=require('path');
const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {admitNewTrailIntake}=require('../workflows/new-trail-intake');

async function main(){
  const root=path.resolve(__dirname,'../..');const [packet,review]=await Promise.all([
    fs.readFile(path.join(root,'backoffice-data','new-trail-scouting.json'),'utf8').then(JSON.parse),
    fs.readFile(path.join(root,'backoffice-data','new-trail-scouting-review.json'),'utf8').then(JSON.parse),
  ]);
  const result=await admitNewTrailIntake(new FirestoreBackofficeStore(),packet,review);
  console.log(`[new-trail-intake] ${result.summary.selected} selected; ${result.summary.admitted||0} admitted; ${result.summary.waiting||0} waiting for fleet capacity.`);
  result.jobIds.forEach(id=>console.log(`[new-trail-intake] ${id}`));return result;
}
if(require.main===module)main().catch(error=>{console.error(`[new-trail-intake] ${error.stack||error.message}`);process.exitCode=1;});
module.exports={main};
