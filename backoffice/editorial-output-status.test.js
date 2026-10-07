'use strict';

// A decision has to reach the output it was made about.
//
// recordVerifiedTrailReview returned what happened and nothing applied it, and
// ingestTrailReviews wrote the review queue and the staging artifact but never
// the execution. So an output said `ready-for-review` forever. Measured on the
// live database 7 October: all six outputs behind the three published trails --
// tre-cime, cinque-torri-assisted, lago-braies -- still read `ready-for-review`,
// with every decision approved and every trail live on the site.
//
// The count being wrong is the small half. The large half is that the first
// genuine editorial queue would have been indistinguishable from that residue,
// because waiting work and finished work gave the same answer.

const {recordVerifiedTrailReview,applyVerifiedTrailReviewStatus}=require('./workflows/apply-content-review');
const {validateContentExecution,REVIEWED_STATUSES}=require('./contracts/content-result-v1');
const {ingestTrailReviews}=require('./workflows/run-live-backoffice-worker');

const output=(jobId,agentId,extra={})=>({jobId,agentId,candidateId:'osm-1',status:'ready-for-review',
  result:{title:'A walk',sections:[],...(agentId==='visualDirector'
    ?{candidates:[{status:'ready',assetUrl:'images/a.jpg',credit:'c',sourcePageUrl:'https://x.test',
        placement:{sourceRef:'trails-data.js',before:'b',after:'a'}}]}:{})},
  ...extra});

const execution=(outputs)=>({contractVersion:'1.0.0',generatedAt:'2026-10-01T00:00:00Z',mode:'draft-only',
  stage:'verified-trail-editorial-review',executionOrigin:'live-orma-verified-handoff',
  sourceQueue:'firestore:verified-trail-editorial-queue',
  publicMutationAllowed:false,publicationAuthorized:false,outputs,
  summary:{trails:1,readyForReview:outputs.length,blocked:0,publicationReady:0}});

describe('a reviewed output stops saying it is waiting',()=>{
  test('an approval moves the output off ready-for-review',()=>{
    const current=execution([output('verified-osm-1-copy','copywriter')]);
    const decisions=[{jobId:'verified-osm-1-copy',action:'approve'}];
    const next=applyVerifiedTrailReviewStatus(current,recordVerifiedTrailReview(current,decisions));
    expect(next.outputs[0].status).toBe('editorial-approved');
    expect(next.summary.readyForReview).toBe(0);
    // The new value has to be one the contract accepts, or the worker's own
    // validate step would reject the artifact it just built.
    expect(validateContentExecution(next)).toEqual([]);
  });

  test('a visual approval is named as the asset decision, not the copy one',()=>{
    const current=execution([output('verified-osm-1-visual','visualDirector')]);
    const next=applyVerifiedTrailReviewStatus(current,
      recordVerifiedTrailReview(current,[{jobId:'verified-osm-1-visual',action:'approve'}]));
    expect(next.outputs[0].status).toBe('asset-and-licensing-approved');
  });

  test('a revision and a rejection move it too',()=>{
    const current=execution([output('a','copywriter'),output('b','copywriter')]);
    const next=applyVerifiedTrailReviewStatus(current,recordVerifiedTrailReview(current,
      [{jobId:'a',action:'request-revision'},{jobId:'b',action:'reject'}]));
    expect(next.outputs.map(entry=>entry.status)).toEqual(['revision-queued','rejected']);
    expect(next.summary.readyForReview).toBe(0);
  });

  test('an output nobody decided on is untouched',()=>{
    const current=execution([output('a','copywriter'),output('b','copywriter')]);
    const next=applyVerifiedTrailReviewStatus(current,
      recordVerifiedTrailReview(current,[{jobId:'a',action:'approve'}]));
    expect(next.outputs[1].status).toBe('ready-for-review');
    expect(next.summary.readyForReview).toBe(1);
  });

  test('a blocked outcome leaves the output exactly as it was',()=>{
    // The decision did not apply, so nothing about the output has changed.
    // Moving it would report work as finished that was not.
    const current=execution([output('a','copywriter')]);
    const next=applyVerifiedTrailReviewStatus(current,
      [{jobId:'a',action:'approve',status:'blocked',message:'no'}]);
    expect(next).toBe(current);
  });

  test('every status it can write is one the contract allows',()=>{
    // The two lists are the same vocabulary; a value here that the validator
    // refuses would make the worker throw on its own output.
    REVIEWED_STATUSES.forEach(status=>{
      expect(validateContentExecution(execution([{...output('a','copywriter'),status}]))).toEqual([]);
    });
  });
});

describe('the worker writes it, not just computes it',()=>{
  // The seam that was missing: every module below was correct on its own and
  // the execution artifact was simply never written back.
  function fakeStore(current){
    const artifacts={'verified-trail-editorial-execution':current,
      'verified-trail-editorial-queue':{items:[{candidateId:'osm-1',targetTrailId:'osm-1',assetPolicy:'preserve-existing'}]},
      'content-review-queue':{submissions:[]}};
    const marks=[];
    return {artifacts,marks,
      listReviews:async()=>[{id:'r-1',submittedAt:'2026-10-07T00:00:00Z',
        decisions:[{jobId:'verified-osm-1-copy',action:'approve'}]}],
      getArtifact:async id=>artifacts[id]??null,
      setArtifact:async(id,value)=>{artifacts[id]=value;},
      listJobs:async()=>[],putJob:async()=>{},
      markReview:async(id,status,fields)=>{marks.push({id,status,...fields});}};
  }

  test('the execution artifact comes back with the decision applied',async()=>{
    const store=fakeStore(execution([output('verified-osm-1-copy','copywriter')]));
    const outcomes=await ingestTrailReviews(store,{productionTrails:[]});
    expect(outcomes).toEqual([expect.objectContaining({status:'processed'})]);
    const written=store.artifacts['verified-trail-editorial-execution'];
    expect(written.outputs[0].status).toBe('editorial-approved');
    expect(written.summary.readyForReview).toBe(0);
  });

  test('a second approval of the same output is refused rather than re-recorded',async()=>{
    // Falls out of the fix: assertVerifiedTrailReviewDecisions only approves a
    // `ready-for-review` output, so once the status moves the guard holds. The
    // decision was previously accepted again and again, each one recorded.
    const store=fakeStore(execution([{...output('verified-osm-1-copy','copywriter'),status:'editorial-approved'}]));
    const outcomes=await ingestTrailReviews(store,{productionTrails:[]});
    expect(outcomes).toEqual([expect.objectContaining({status:'blocked'})]);
    expect(store.marks[0].error).toMatch(/Only a ready proposal can be approved/);
  });
});
