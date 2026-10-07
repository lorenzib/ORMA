'use strict';

const {summariseJobQueue,CLAIMABLE,WAITING,RETIRED_LANE,UNKNOWN_TRAIL}=require('./workflows/job-queue-health');

// 116 queued jobs, 0 running, 0 blocked, and every pass reporting "no agent
// work to pick up". The funnel called those trails not stalled because a queued
// job counts as work owed; pipeline-health counted them under working. A job
// can be queued and unclaimable, and nothing said so.

const NOW=Date.parse('2026-10-06T16:00:00.000Z');
const LANES=['trail-verification-specialist','trail-claim-resolution'];
const TRAILS=new Set(['tre-cime','lago-braies']);

function job(overrides={}){
  return {id:'job-1',status:'queued',jobType:'trail-claim-resolution',candidateId:'tre-cime',
    createdAt:'2026-09-01T00:00:00.000Z',...overrides};
}
function summarise(jobs,options={}){
  return summariseJobQueue(jobs,{nowMs:NOW,processableJobTypes:LANES,trailIds:TRAILS,headCount:3,...options});
}

describe('what is holding a queued job', () => {
  test('a job whose time has come is claimable',()=>{
    const report=summarise([job({notBefore:'2026-10-06T15:00:00.000Z'})]);
    expect(report.claimableNow).toBe(1);
    expect(report.head.jobs[0].status).toBe(CLAIMABLE);
  });

  test('a job scheduled for later says when, in minutes a person can act on',()=>{
    const report=summarise([job({notBefore:'2026-10-06T16:45:00.000Z'})]);
    expect(report.claimableNow).toBe(0);
    // Listed as scheduled, not as the head: the worker skips it before taking
    // its batch, so it is waiting on a clock rather than on the worker.
    expect(report.head.jobs).toEqual([]);
    expect(report.scheduled[0]).toEqual(expect.objectContaining({status:WAITING,inMinutes:45,
      until:'2026-10-06T16:45:00.000Z'}));
    expect(report.soonestClaimable).toBe(45);
  });

  test('a lane with no processor left is named, not counted as work',()=>{
    expect(summarise([job({jobType:'hosted-image-sourcing'})]).byReason)
      .toEqual([{reason:RETIRED_LANE,count:1}]);
  });

  test('a job for a trail the catalogue does not have cannot run either',()=>{
    expect(summarise([job({candidateId:'osm-relation-1484751'})]).byReason)
      .toEqual([{reason:UNKNOWN_TRAIL,count:1}]);
  });

  test('a running job is not part of the queue question',()=>{
    expect(summarise([job({status:'running'})]).queued).toBe(0);
  });
});

describe('the head is the worker\'s head, not the queue\'s', () => {
  // The first run of this tool reported ten jobs in a deleted lane as the cause
  // of the stall. The worker filters by job type before it takes its batch, so
  // those jobs were never in front of anything.
  const dead=Array.from({length:4},(_,index)=>job({id:`dead-${index}`,jobType:'hosted-image-sourcing',
    candidateId:null,createdAt:`2026-08-0${index+1}T00:00:00.000Z`}));

  test('a retired lane at the front of the queue is beside it, not in front of it',()=>{
    const report=summarise([...dead,job({id:'live',createdAt:'2026-09-20T00:00:00.000Z'})]);
    expect(report.head.jobs.map(entry=>entry.id)).toEqual(['live']);
    expect(report.head.claimable).toBe(1);
    expect(report.starved).toBe(false);
    expect(report.outsideEveryLane).toBe(4);
  });

  test('a retired lane never makes the queue look starved',()=>{
    const report=summarise([...dead,job({id:'later',createdAt:'2026-09-20T00:00:00.000Z',
      notBefore:'2026-10-06T18:00:00.000Z'})]);
    expect(report.starved).toBe(false);
    expect(report.claimableNow).toBe(0);
  });
});

describe('the head of the queue is what decides whether anything runs', () => {
  // The worker filters twice before taking its batch -- to the lanes it runs,
  // and (since #615) to the jobs that are due. Neither sits in front of
  // anything, so neither can starve the pass.
  const head=[
    job({id:'old-1',createdAt:'2026-09-01T00:00:00.000Z',notBefore:'2026-10-07T00:00:00.000Z'}),
    job({id:'old-2',createdAt:'2026-09-02T00:00:00.000Z',notBefore:'2026-10-07T00:00:00.000Z'}),
    job({id:'old-3',createdAt:'2026-09-03T00:00:00.000Z',notBefore:'2026-10-07T00:00:00.000Z'}),
  ];
  const behind=job({id:'new-1',createdAt:'2026-10-05T00:00:00.000Z'});

  // What this tool reported for a day after #615 landed: STARVED, against a
  // worker that had just been changed to skip exactly these jobs.
  test('old scheduled jobs no longer starve the work behind them',()=>{
    const report=summarise([...head,behind]);
    expect(report.head.jobs.map(entry=>entry.id)).toEqual(['new-1']);
    expect(report.head.claimable).toBe(1);
    expect(report.claimableNow).toBe(1);
    expect(report.starved).toBe(false);
    expect(report.scheduled).toHaveLength(3);
  });

  // Starvation is still real for a job the worker does claim and cannot run:
  // an unknown trail is claimed, fails, and spends a slot doing it.
  test('but a head of unrunnable jobs still starves what waits behind',()=>{
    const unknown=index=>job({id:`u-${index}`,createdAt:`2026-09-0${index}T00:00:00.000Z`,
      candidateId:'osm-relation-1484751'});
    const report=summarise([unknown(1),unknown(2),unknown(3),behind],{headCount:3});
    expect(report.head.claimable).toBe(0);
    expect(report.claimableNow).toBe(1);
    expect(report.starved).toBe(true);
  });

  test('a head that can be claimed is not starvation, however long the queue',()=>{
    const fine=summarise([job({id:'ready',createdAt:'2026-08-01T00:00:00.000Z'}),...head]);
    expect(fine.head.jobs[0].id).toBe('ready');
    expect(fine.starved).toBe(false);
  });

  test('an empty queue is not starved',()=>{
    expect(summarise([]).starved).toBe(false);
  });

  test('a queue with nothing claimable anywhere is waiting, not starved',()=>{
    // Starvation means work exists that this pass will not reach. If nothing
    // can run at all, the answer is the schedule, not the ordering.
    expect(summarise(head).starved).toBe(false);
  });

  test('reads oldest first among the jobs the worker will actually look at',()=>{
    const older=job({id:'old-ready',createdAt:'2026-08-01T00:00:00.000Z'});
    const report=summarise([behind,...head,older]);
    expect(report.head.jobs.map(entry=>entry.id)).toEqual(['old-ready','new-1']);
  });
});
