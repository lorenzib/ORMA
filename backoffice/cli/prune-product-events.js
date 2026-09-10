#!/usr/bin/env node
'use strict';

const {backofficeDb}=require('../services/firestore-backoffice-store');

const RETENTION_DAYS=30;
const DEFAULT_BATCH_SIZE=400;
const DEFAULT_MAX_BATCHES=20;

function cutoffIso(at=new Date()){
  const cutoff=new Date(new Date(at).getTime()-RETENTION_DAYS*24*60*60*1000);
  if(Number.isNaN(cutoff.getTime()))throw new TypeError('A valid retention time is required');
  cutoff.setUTCMinutes(0,0,0);
  return cutoff.toISOString();
}

async function pruneProductEvents(db,options={}){
  const cutoff=options.cutoff||cutoffIso(options.at);
  const batchSize=Number.isInteger(options.batchSize)&&options.batchSize>0?Math.min(options.batchSize,450):DEFAULT_BATCH_SIZE;
  const maxBatches=Number.isInteger(options.maxBatches)&&options.maxBatches>0?options.maxBatches:DEFAULT_MAX_BATCHES;
  let deleted=0;
  let batches=0;
  while(batches<maxBatches){
    const snapshot=await db.collection('productEvents')
      .where('occurredHour','<',cutoff)
      .orderBy('occurredHour','asc')
      .limit(batchSize)
      .get();
    if(snapshot.empty)break;
    const batch=db.batch();
    snapshot.docs.forEach(document=>batch.delete(document.ref));
    await batch.commit();
    deleted+=snapshot.size;
    batches+=1;
    if(snapshot.size<batchSize)break;
  }
  return {cutoff,deleted,batches,capped:batches===maxBatches};
}

async function main(){
  const result=await pruneProductEvents(backofficeDb());
  console.log(`[product-events] removed ${result.deleted} record(s) older than ${result.cutoff}${result.capped?' · daily cap reached':''}`);
}

if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
module.exports={RETENTION_DAYS,DEFAULT_BATCH_SIZE,DEFAULT_MAX_BATCHES,cutoffIso,pruneProductEvents};
