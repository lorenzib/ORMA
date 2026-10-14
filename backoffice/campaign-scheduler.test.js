'use strict';

const {campaignEligibility,runScheduledTrailCampaign}=require('./workflows/campaign-scheduler');

const at='2026-08-20T06:15:00.000Z';
const trails=[{id:'trail-a',name:'Trail A',curated:true,osmRelation:1,path:[[46,11],[46.01,11.01],[46,11]]}];

function memoryStore(seed={}){
  const artifacts={...seed};const jobs=new Map();const writes=[];
  return {artifacts,jobs,writes,
    getArtifact:async id=>artifacts[id]||null,
    setArtifact:async(id,value,metadata)=>{artifacts[id]=value;writes.push({id,value,metadata});},
    putJobIfAbsent:async job=>{if(jobs.has(job.id))return false;jobs.set(job.id,job);return true;},
  };
}

describe('reliable catalogue campaign scheduling',()=>{
  test('runs only when due unless an operator explicitly forces it',()=>{
    const previous={lastSuccessfulAt:'2026-08-20T05:00:00.000Z',nextEligibleAt:'2026-08-21T05:00:00.000Z'};
    expect(campaignEligibility(previous,{at}).due).toBe(false);
    expect(campaignEligibility(previous,{at,force:true}).due).toBe(true);
  });

  // Eligibility lands on the next campaign window (09:30 Europe/Rome), not 24
  // hours after completion. A rolling interval let a run at an odd hour push the
  // next one past the cron: a success at 12:12 made the 09:30 cron four hours
  // early, and the day was skipped. Here the run completes at 08:16 Rome, before
  // that morning's window, so it becomes eligible at 09:30 the same day rather
  // than at 08:16 tomorrow -- a run before the quota reset must not consume the
  // day it never got to use.
  test('records running and healthy receipts and creates an idempotent admission job',async()=>{
    const store=memoryStore();
    const result=await runScheduledTrailCampaign(store,trails,{enabled:true,at,completedAt:'2026-08-20T06:16:00.000Z',runId:'123',workflowRunUrl:'https://github.com/lorenzib/ORMA/actions/runs/123'});
    expect(result).toEqual(expect.objectContaining({status:'completed',jobIds:['trail-verification-trail-a-cartographer-1'],nextEligibleAt:'2026-08-20T07:30:00.000Z'}));
    expect([...store.jobs]).toHaveLength(1);
    expect(store.writes.filter(write=>write.id==='trail-campaign-health').map(write=>write.value.status)).toEqual(['running','healthy']);
    expect(store.artifacts['trail-campaign-health']).toEqual(expect.objectContaining({status:'healthy',lastResult:expect.objectContaining({admitted:1,remainingQueueable:0})}));
    const repeated=await runScheduledTrailCampaign(store,trails,{enabled:true,at:'2026-08-20T07:00:00.000Z'});
    expect(repeated.status).toBe('not-due');expect([...store.jobs]).toHaveLength(1);
  });

  test('retains a durable failure receipt and a bounded retry time',async()=>{
    const writes=[];const store={getArtifact:async()=>null,setArtifact:async(id,value)=>writes.push({id,value})};
    await expect(runScheduledTrailCampaign(store,trails,{enabled:true,at,completedAt:'2026-08-20T06:16:00.000Z'})).rejects.toThrow();
    expect(writes.at(-1).value).toEqual(expect.objectContaining({status:'failed',nextEligibleAt:'2026-08-20T07:16:00.000Z',lastFailure:expect.objectContaining({outcome:'failure'})}));
  });
});

// The scheduler has always taken `force` and nothing ever passed it, so a
// trail named for the pipeline joined a queue for the next morning instead of
// going in. Dispatched at 13:00 the campaign answered "not-due, next eligible
// 07:30 tomorrow", and nothing said so -- the request looked accepted and
// simply never happened, the same way the capacity budget refused it silently.
describe('naming a trail is the ask, not a request to queue for tomorrow',()=>{
  const {workerOptions}=require('./cli/live-worker');
  const fs=require('fs');
  const path=require('path');

  test('a campaign that is not due runs anyway when a trail is named',()=>{
    const previous={nextEligibleAt:'2026-08-21T07:30:00.000Z',lastSuccessfulAt:'2026-08-20T07:30:00.000Z'};
    expect(campaignEligibility(previous,{at}).due).toBe(false);
    expect(campaignEligibility(previous,{at,force:true}).due).toBe(true);
  });

  test('the worker forces it exactly when trails were named',()=>{
    // Read off the call site, so the wiring cannot be quietly removed.
    const worker=fs.readFileSync(path.join(__dirname,'workflows/run-live-backoffice-worker.js'),'utf8');
    expect(worker).toContain('force:(options.reverifyTrailIds||[]).length>0');
  });

  test('named ids reach the worker options from the environment',()=>{
    expect(workerOptions({ORMA_REVERIFY_TRAIL_IDS:'tre-cime, lago-braies'}).reverifyTrailIds)
      .toEqual(['tre-cime','lago-braies']);
    // An ordinary pass names nothing and keeps the daily rhythm.
    expect(workerOptions({}).reverifyTrailIds).toEqual([]);
  });
});

// Named ids travel: workflow input -> environment -> workerOptions ->
// runScheduledTrailCampaign -> startLiveTrailCampaign -> planCatalogueCampaign.
//
// Every link had a passing test and the chain was still broken. The scheduler
// named four options when it called the planner and dropped the rest, so the
// ids stopped one call short of the thing that reads them. The campaign ran,
// reported `reverifying: 0`, and admitted nothing. Three separate releases
// went out before production showed it.
//
// So this walks the whole chain in one go rather than each link apart.
describe('a named trail survives every hop from the workflow input',()=>{
  const fs=require('fs');
  const path=require('path');
  const {workerOptions}=require('./cli/live-worker');

  function catalogue(){
    const src=fs.readFileSync(path.join(__dirname,'../data/regions/dolomites-trails.js'),'utf8');
    return JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]);
  }

  test('the id named in the workflow reaches the jobs the campaign creates',async()=>{
    const trails=catalogue();
    // A real graduated trail: the case the whole chain exists for.
    const sealed=trails.find(trail=>trail.graduation?.status==='verified');
    expect(sealed).toBeTruthy();

    // 1. The workflow input, as the YAML sets it.
    const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/orma-backoffice-worker.yml'),'utf8');
    expect(workflow).toContain('ORMA_REVERIFY_TRAIL_IDS: ${{ github.event.inputs.reverify_trail_ids');

    // 2. The environment, through the worker's own option builder.
    const options=workerOptions({ORMA_REVERIFY_TRAIL_IDS:sealed.id});
    expect(options.reverifyTrailIds).toEqual([sealed.id]);

    // 3-5. Scheduler, campaign starter, planner -- and the job at the end.
    const store=memoryStore();
    const result=await runScheduledTrailCampaign(store,trails,{
      enabled:true,at,limit:5,capacity:5,
      reverifyTrailIds:options.reverifyTrailIds,
      force:options.reverifyTrailIds.length>0,
    });
    expect(result.status).toBe('completed');
    expect([...store.jobs.values()].map(job=>job.candidateId)).toContain(sealed.id);
  });

  test('without the name, the same graduated trail is left alone',async()=>{
    const trails=catalogue();
    const sealed=trails.find(trail=>trail.graduation?.status==='verified');
    const store=memoryStore();
    await runScheduledTrailCampaign(store,trails,{enabled:true,at,limit:5,capacity:5,force:true});
    expect([...store.jobs.values()].map(job=>job.candidateId)).not.toContain(sealed.id);
  });
});
