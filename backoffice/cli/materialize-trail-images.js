#!/usr/bin/env node
'use strict';

const path=require('path');
const {getStorage}=require('firebase-admin/storage');
const {FirestoreBackofficeStore,adminApp}=require('../services/firestore-backoffice-store');
const {materializeApprovedTrailImages}=require('../workflows/materialize-approved-trail-images');

async function main(){
  const root=path.resolve(__dirname,'../..');const store=new FirestoreBackofficeStore();
  const bucket=getStorage(adminApp()).bucket();
  const result=await materializeApprovedTrailImages({root,store,bucket});
  console.log(result.materialized
    ?`[trail-images] Materialized ${result.materialized} approved trail photo(s) for a publication PR.`
    :'[trail-images] No approved trail photos are waiting for publication.');
}

if(require.main===module)main().catch(error=>{console.error(`[trail-images] ${error.stack||error.message}`);process.exitCode=1;});

module.exports={main};
