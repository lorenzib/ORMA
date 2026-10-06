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
    expect(report.head.jobs[0]).toEqual(expect.objectContaining({status:WAITING,inMinutes:45,
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

describe('the head of the queue is what decides whether anything runs', () => {
  // The worker takes the oldest N per pass and stops there, so a few
  // unclaimable jobs at the front starve everything behind them.
  const head=[
    job({id:'old-1',createdAt:'2026-09-01T00:00:00.000Z',notBefore:'2026-10-07T00:00:00.000Z'}),
    job({id:'old-2',createdAt:'2026-09-02T00:00:00.000Z',notBefore:'2026-10-07T00:00:00.000Z'}),
    job({id:'old-3',createdAt:'2026-09-03T00:00:00.000Z',jobType:'hosted-image-sourcing'}),
  ];
  const behind=job({id:'new-1',createdAt:'2026-10-05T00:00:00.000Z'});

  test('names the starvation rather than reporting an idle worker',()=>{
    const report=summarise([...head,behind]);
    expect(report.head.claimable).toBe(0);
    expect(report.claimableNow).toBe(1);
    expect(report.starved).toBe(true);
  });

  test('a head that can be claimed is not starvation, however long the queue',()=>{
    const report=summarise([behind,...head]);
    expect(report.head.jobs[0].id).toBe('old-1');
    const fine=summarise([job({id:'ready',createdAt:'2026-08-01T00:00:00.000Z'}),...head]);
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

  test('reads oldest first, because that is the order the worker reads',()=>{
    const report=summarise([behind,...head]);
    expect(report.head.jobs.map(entry=>entry.id)).toEqual(['old-1','old-2','old-3']);
  });
});
