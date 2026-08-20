#!/usr/bin/env node
'use strict';

const {FirestoreBackofficeStore}=require('../services/firestore-backoffice-store');
const {ingestNewTrailReviews,ingestHazardReviews}=require('../workflows/run-live-backoffice-worker');

async function main(args=process.argv.slice(2)){
  const scope=args[0];const store=new FirestoreBackofficeStore();let result;
  if(scope==='new-trails')result=await ingestNewTrailReviews(store);
  else if(scope==='hazards')result=await ingestHazardReviews(store);
  else throw new Error('Scope must be new-trails or hazards');
  console.log(JSON.stringify({scope,result,completedAt:new Date().toISOString(),publicMutationAllowed:false},null,2));
  if(result.some(item=>item.status==='blocked'))process.exitCode=1;
}

if(require.main===module)main().catch(error=>{console.error(`[scoped-review-worker] ${error.stack||error.message}`);process.exitCode=1;});
module.exports={main};
