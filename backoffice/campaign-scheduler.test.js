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

  test('records running and healthy receipts and creates an idempotent admission job',async()=>{
    const store=memoryStore();
    const result=await runScheduledTrailCampaign(store,trails,{enabled:true,at,completedAt:'2026-08-20T06:16:00.000Z',runId:'123',workflowRunUrl:'https://github.com/lorenzib/ORMA/actions/runs/123'});
    expect(result).toEqual(expect.objectContaining({status:'completed',jobIds:['trail-verification-trail-a-cartographer-1'],nextEligibleAt:'2026-08-21T06:16:00.000Z'}));
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
