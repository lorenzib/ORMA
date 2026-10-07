'use strict';

const {FirestoreUsageMeter,queryReads}=require('./services/firestore-usage');
const {FirestoreBackofficeStore,encodeArtifactData}=require('./services/firestore-backoffice-store');

// A fake db that behaves like Firestore for the calls the store makes, so the
// count can be checked against what Firestore would bill: one read per
// document returned (one per query at minimum), one write per document set,
// updated or added.
function fakeDb(jobsByStatus={}){
  const docs=new Map();
  const doc=(id)=>({
    get:async()=>({exists:docs.has(id),id,data:()=>docs.get(id)}),
    set:async(value)=>{docs.set(id,{...(docs.get(id)||{}),...value});},
    update:async(value)=>{docs.set(id,{...(docs.get(id)||{}),...value});},
  });
  const snapshotOf=(items)=>({size:items.length,docs:items.map(item=>({id:item.id,ref:doc(item.id),data:()=>item}))});
  return {
    settings(){},
    collection:()=>({
      doc,
      add:async(value)=>{const id=`added-${docs.size}`;docs.set(id,value);return {id};},
      where:(field,op,status)=>{
        const query={get:async()=>snapshotOf(jobsByStatus[status]||[]),limit:()=>query};
        return query;
      },
    }),
    getAll:async(...refs)=>refs.map((ref,index)=>({exists:true,id:`job-${index}`,data:()=>({})})),
    batch:()=>({update(){},async commit(){}}),
    runTransaction:async(fn)=>fn({get:async(ref)=>ref.get(),set:(ref,value)=>ref.set(value),update:(ref,value)=>ref.update(value)}),
  };
}

describe('Firestore usage meter',()=>{
  test('an empty query still costs one read, a full one costs one per document',()=>{
    expect(queryReads({size:0,docs:[]})).toBe(1);
    expect(queryReads({docs:[1,2,3]})).toBe(3);
    expect(queryReads(undefined)).toBe(1);
  });

  test('a snapshot and the spend since it',()=>{
    const meter=new FirestoreUsageMeter();
    meter.read(5).write(2);
    const before=meter.snapshot();
    meter.read(3).write(1);
    expect(meter.since(before)).toEqual({reads:3,writes:1,readCalls:1,writeCalls:1});
    expect(meter.snapshot()).toEqual({reads:8,writes:3,readCalls:2,writeCalls:2});
  });

  test('the store counts documents, not calls, and never counts a cache hit',async()=>{
    const store=new FirestoreBackofficeStore({db:fakeDb({queued:[{id:'a',status:'queued'},{id:'b',status:'queued'}],running:[]})});
    await store.getArtifact('trail-orchestration');
    await store.getArtifact('trail-orchestration');
    expect(store.usage.snapshot()).toMatchObject({reads:1,writes:0});
    await store.setArtifact('trail-orchestration',{v:1});
    expect(store.usage.writes).toBe(1);
    // Two statuses, two queries: two documents plus one billed read for the empty one.
    await store.listJobs(['queued','running']);
    await store.listJobs(['queued','running']);
    expect(store.usage.reads).toBe(1+3);
    // The fake answers every collection with the same two queued documents.
    await store.listDossierReviews('queued');
    expect(store.usage.reads).toBe(1+3+2);
    const written=await store.submitDossierReview({reviewId:'r1',candidateId:'c1',action:'approve',submittedBy:'test'});
    expect(written).toBeTruthy();
    expect(store.usage.writes).toBe(2);
  });

  test('a claim is one read and, when it succeeds, one write',async()=>{
    const db=fakeDb();
    const store=new FirestoreBackofficeStore({db});
    await store.putJob({id:'job-1',status:'queued'});
    expect(store.usage.snapshot()).toMatchObject({reads:0,writes:1});
    const claimed=await store.claimJob('job-1','worker');
    expect(claimed).toMatchObject({id:'job-1',status:'running'});
    expect(store.usage.snapshot()).toMatchObject({reads:1,writes:2});
    expect(await store.claimJob('job-1','worker')).toBeNull();
    expect(store.usage.snapshot()).toMatchObject({reads:2,writes:2});
    await store.completeSystemJob('job-1',{});
    expect(store.usage.writes).toBe(3);
  });

  test('one meter can be shared across stores, so a loop of passes adds up',async()=>{
    const usage=new FirestoreUsageMeter();
    const first=new FirestoreBackofficeStore({db:fakeDb(),usage});
    const second=new FirestoreBackofficeStore({db:fakeDb(),usage});
    await first.getArtifact('x');await second.getArtifact('x');
    expect(usage.reads).toBe(2);
    expect(first.usage).toBe(second.usage);
  });
});
