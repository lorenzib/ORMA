'use strict';

const {beginWorkerRun,finishWorkerRun}=require('./workflows/worker-health');
const {main,runInput}=require('./cli/record-worker-health');

describe('durable ORMA worker health receipts',()=>{
  test('records a running heartbeat then a successful bounded history receipt',()=>{
    const started=beginWorkerRun(null,{runId:'123',runAttempt:'2',workflowRunUrl:'https://github.com/orma/actions/runs/123',eventName:'schedule',branch:'main',commitSha:'abc'},{at:'2026-08-19T20:00:00Z'});
    expect(started).toEqual(expect.objectContaining({status:'running',runId:'123',runAttempt:2,expectedIntervalMinutes:5,consecutiveFailures:0}));
    const completed=finishWorkerRun(started,{outcome:'success'},{at:'2026-08-19T20:03:00Z'});
    expect(completed).toEqual(expect.objectContaining({status:'healthy',durationMs:180000,lastSuccessfulAt:'2026-08-19T20:03:00Z',consecutiveFailures:0}));
    expect(completed.recentRuns).toEqual([expect.objectContaining({runId:'123',outcome:'success'})]);
  });

  test('preserves the exact failed stage, run link and consecutive failure count',()=>{
    const first=finishWorkerRun(beginWorkerRun(null,{runId:'1',workflowRunUrl:'https://github.com/orma/actions/runs/1'},{at:'2026-08-19T20:00:00Z'}),{outcome:'failure',failureStage:'website-validation',failureMessage:'Tests failed.'},{at:'2026-08-19T20:02:00Z'});
    const second=finishWorkerRun(beginWorkerRun(first,{runId:'2',workflowRunUrl:'https://github.com/orma/actions/runs/2'},{at:'2026-08-19T20:05:00Z'}),{outcome:'failure',failureStage:'pull-request-creation',failureMessage:'GitHub denied PR creation.'},{at:'2026-08-19T20:07:00Z'});
    expect(second).toEqual(expect.objectContaining({status:'failed',consecutiveFailures:2,lastFailedAt:'2026-08-19T20:07:00Z'}));
    expect(second.lastFailure).toEqual(expect.objectContaining({stage:'pull-request-creation',message:'GitHub denied PR creation.',workflowRunUrl:'https://github.com/orma/actions/runs/2'}));
    expect(second.recentRuns).toHaveLength(2);
  });

  test('CLI writes the protected start heartbeat with GitHub identity',async()=>{
    const writes=[];const store={getArtifact:async()=>null,setArtifact:async(id,data,metadata)=>writes.push({id,data,metadata})};
    const env={ORMA_WORKER_HEALTH_PHASE:'start',GITHUB_RUN_ID:'456',GITHUB_RUN_ATTEMPT:'1',GITHUB_SERVER_URL:'https://github.com',GITHUB_REPOSITORY:'lorenzib/ORMA',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF_NAME:'main',GITHUB_SHA:'def'};
    const result=await main({store,env,at:'2026-08-19T21:00:00Z'});
    expect(runInput(env).workflowRunUrl).toBe('https://github.com/lorenzib/ORMA/actions/runs/456');
    expect(result.status).toBe('running');
    expect(writes).toEqual([expect.objectContaining({id:'worker-health',metadata:{runId:'456',status:'running'}})]);
  });
});
