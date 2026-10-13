'use strict';

const {beginWorkerRun,finishWorkerRun}=require('./workflows/worker-health');
const {announceHealth,healthOutputs,main,runInput}=require('./cli/record-worker-health');
const fs=require('fs/promises');
const os=require('os');
const path=require('path');

describe('durable ORMA worker health receipts',()=>{
  test('records a running heartbeat then a successful bounded history receipt',()=>{
    const started=beginWorkerRun(null,{runId:'123',runAttempt:'2',workflowRunUrl:'https://github.com/orma/actions/runs/123',eventName:'schedule',branch:'main',commitSha:'abc'},{at:'2026-08-19T20:00:00Z'});
    expect(started).toEqual(expect.objectContaining({status:'running',runId:'123',runAttempt:2,expectedIntervalMinutes:180,delayAfterMinutes:210,staleAfterMinutes:390,consecutiveFailures:0}));
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

  test('records a blocked publication gate without counting a queue-worker failure',()=>{
    const started=beginWorkerRun({consecutiveFailures:2,lastSuccessfulAt:'2026-09-05T07:00:00Z'}, {runId:'3',commitSha:'abc'},{at:'2026-09-05T08:00:00Z'});
    const blocked=finishWorkerRun(started,{outcome:'blocked',failureStage:'website-publication-gate',failureMessage:'Validate ORMA failed. Queue and agent work may continue; approvals stay saved.',validationRunUrl:'https://github.com/orma/actions/runs/3'},{at:'2026-09-05T08:02:00Z'});
    expect(blocked).toEqual(expect.objectContaining({status:'blocked',lastBlockedAt:'2026-09-05T08:02:00Z',consecutiveFailures:2,lastSuccessfulAt:'2026-09-05T07:00:00Z'}));
    expect(blocked.publicationGate).toEqual(expect.objectContaining({stage:'website-publication-gate',commitSha:'abc',validationRunUrl:'https://github.com/orma/actions/runs/3'}));
    expect(blocked.recentRuns.at(-1)).toEqual(expect.objectContaining({outcome:'blocked'}));
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

// A worker that dies quietly is worse than one that never starts. The count was
// recorded from the first run and read only by the dashboard: the worker
// stopped at 16:00 on 13 October and was found hours later by being asked
// about. These assertions are read off the receipt the producer actually
// writes, because the first version of this read `failure` instead of
// `lastFailure` and reported every stopped worker's stage as blank.
describe('saying so when the worker has stopped',()=>{
  function twoFailuresInARow(){
    const first=finishWorkerRun(beginWorkerRun(null,{runId:'1'},{at:'2026-10-13T13:00:00Z'}),{outcome:'success'},{at:'2026-10-13T13:02:00Z'});
    const second=finishWorkerRun(beginWorkerRun(first,{runId:'2'},{at:'2026-10-13T16:00:00Z'}),{outcome:'failure',failureStage:'agent-work',failureMessage:'Document exceeds the maximum allowed size.'},{at:'2026-10-13T16:02:00Z'});
    return finishWorkerRun(beginWorkerRun(second,{runId:'3'},{at:'2026-10-13T19:00:00Z'}),{outcome:'failure',failureStage:'agent-work',failureMessage:'Document exceeds the maximum allowed size.'},{at:'2026-10-13T19:02:00Z'});
  }

  test('reports the stopped worker by the names the receipt actually uses',()=>{
    const stopped=twoFailuresInARow();
    expect(healthOutputs(stopped)).toEqual({
      health_status:stopped.status,
      consecutive_failures:String(stopped.consecutiveFailures),
      last_successful_at:stopped.lastSuccessfulAt,
      failure_stage:stopped.lastFailure.stage,
    });
    // The alarm only fires from the second failure, and only a named stage
    // tells anybody where to look.
    expect(Number(healthOutputs(stopped).consecutive_failures)).toBeGreaterThanOrEqual(2);
    expect(healthOutputs(stopped).failure_stage).not.toBe('');
  });

  test('a recovered run reports nothing standing, so the alarm closes itself',()=>{
    const recovered=finishWorkerRun(beginWorkerRun(twoFailuresInARow(),{runId:'4'},{at:'2026-10-13T22:00:00Z'}),{outcome:'success'},{at:'2026-10-13T22:02:00Z'});
    expect(healthOutputs(recovered)).toEqual(expect.objectContaining({health_status:'healthy',consecutive_failures:'0'}));
  });

  test('a provider message cannot break out of the GitHub output file',()=>{
    const stage=healthOutputs({lastFailure:{stage:'agent-work\nconsecutive_failures=0'}}).failure_stage;
    expect(stage).not.toMatch(/[\r\n]/);
  });

  test('the CLI writes the stopped worker to the step outputs',async()=>{
    const file=path.join(await fs.mkdtemp(path.join(os.tmpdir(),'orma-health-')),'outputs.txt');
    const previous=twoFailuresInARow();
    const store={getArtifact:async()=>previous,setArtifact:async()=>{}};
    const env={GITHUB_OUTPUT:file,GITHUB_RUN_ID:'5',ORMA_WORKER_HEALTH_OUTCOME:'failure',ORMA_WORKER_FAILURE_STAGE:'agent-work',ORMA_WORKER_FAILURE_MESSAGE:'Document exceeds the maximum allowed size.'};
    const health=await main({store,env,at:'2026-10-14T01:02:00Z'});
    const written=Object.fromEntries((await fs.readFile(file,'utf8')).trim().split('\n').map(line=>line.split('=')));
    expect(written).toEqual(healthOutputs(health));
    expect(written.consecutive_failures).toBe(String(previous.consecutiveFailures+1));
  });

  test('nothing is written when the run is not inside a GitHub step',async()=>{
    expect(await announceHealth({status:'failed',consecutiveFailures:2},{})).toBeNull();
  });
});
