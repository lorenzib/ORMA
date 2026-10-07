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

class FirestoreUsageMeter {
  constructor(){this.reads=0;this.writes=0;this.readCalls=0;this.writeCalls=0;}
  read(documents=1){const n=Math.max(0,Number(documents)||0);this.reads+=n;this.readCalls+=1;return this;}
  write(documents=1){const n=Math.max(0,Number(documents)||0);this.writes+=n;this.writeCalls+=1;return this;}
  snapshot(){return {reads:this.reads,writes:this.writes,readCalls:this.readCalls,writeCalls:this.writeCalls};}
  /** What was spent after an earlier snapshot. */
  since(earlier={}){
    return {reads:this.reads-(earlier.reads||0),writes:this.writes-(earlier.writes||0),
      readCalls:this.readCalls-(earlier.readCalls||0),writeCalls:this.writeCalls-(earlier.writeCalls||0)};
  }
}

module.exports={FirestoreUsageMeter,queryReads};
