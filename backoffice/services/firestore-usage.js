'use strict';

// How much Firestore quota a pass actually spent.
//
// The dolopaws project is on the free tier (about 50,000 reads and 20,000
// writes a day, reset at midnight US-Pacific). On 2026-10-06 the quota ran out
// at 20:58 UTC and every worker pass until the reset failed with
// RESOURCE_EXHAUSTED -- and nobody could say what a pass costs, because nothing
// counted. Firestore bills per document read or written, not per query, so the
// store counts documents at every call site and this meter adds them up.
//
// A query that matches nothing still costs one read; a cached read costs none,
// and the store does not call the meter for cache hits.

function queryReads(snapshot){
  const size=Number.isFinite(snapshot?.size)?snapshot.size:(snapshot?.docs?.length||0);
  return Math.max(1,size);
}

// A total says a pass cost 2,304 reads. It does not say where they went, so the
// next thing to narrow is a guess -- and the first guess about this was wrong:
// the orchestration scan was blamed for a read the store had already stopped
// making. Each call site names itself, so the ledger can rank them.
const UNATTRIBUTED='unattributed';

class FirestoreUsageMeter {
  constructor(){this.reads=0;this.writes=0;this.readCalls=0;this.writeCalls=0;this.bySource=new Map();}

  /** The running tally for one call site, created on first use. */
  source(name){
    const key=String(name||UNATTRIBUTED);
    if(!this.bySource.has(key))this.bySource.set(key,{reads:0,writes:0,readCalls:0,writeCalls:0});
    return this.bySource.get(key);
  }

  read(documents=1,source){
    const n=Math.max(0,Number(documents)||0);
    this.reads+=n;this.readCalls+=1;
    const tally=this.source(source);tally.reads+=n;tally.readCalls+=1;
    return this;
  }

  write(documents=1,source){
    const n=Math.max(0,Number(documents)||0);
    this.writes+=n;this.writeCalls+=1;
    const tally=this.source(source);tally.writes+=n;tally.writeCalls+=1;
    return this;
  }

  /** A plain object, so a snapshot can be kept and diffed without aliasing. */
  sources(){
    const out={};
    for(const [name,tally] of this.bySource)out[name]={...tally};
    return out;
  }

  snapshot(){
    return {reads:this.reads,writes:this.writes,readCalls:this.readCalls,writeCalls:this.writeCalls,
      bySource:this.sources()};
  }

  /** What was spent after an earlier snapshot, per call site as well as in total. */
  since(earlier={}){
    const before=earlier.bySource||{};
    const bySource={};
    for(const [name,tally] of this.bySource){
      const was=before[name]||{reads:0,writes:0,readCalls:0,writeCalls:0};
      const spent={reads:tally.reads-(was.reads||0),writes:tally.writes-(was.writes||0),
        readCalls:tally.readCalls-(was.readCalls||0),writeCalls:tally.writeCalls-(was.writeCalls||0)};
      if(spent.reads||spent.writes||spent.readCalls||spent.writeCalls)bySource[name]=spent;
    }
    return {reads:this.reads-(earlier.reads||0),writes:this.writes-(earlier.writes||0),
      readCalls:this.readCalls-(earlier.readCalls||0),writeCalls:this.writeCalls-(earlier.writeCalls||0),
      bySource};
  }
}

/** Call sites ranked by documents read, which is what the free tier rations. */
function costliestSources(bySource={},limit=8){
  return Object.entries(bySource)
    .map(([source,tally])=>({source,...tally}))
    .sort((a,b)=>(b.reads||0)-(a.reads||0))
    .slice(0,limit);
}

module.exports={FirestoreUsageMeter,queryReads,costliestSources,UNATTRIBUTED};
