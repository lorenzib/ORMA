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
    expect(healthOutputs(stopped)).toEqual(expect.objectContaining({
      health_status:stopped.status,
      consecutive_failures:String(stopped.consecutiveFailures),
      last_successful_at:stopped.lastSuccessfulAt,
      failure_stage:stopped.lastFailure.stage,
    }));
    // Every value is a single line: the workflow reads them as plain
    // `key=value` pairs, and a newline in one would end the value early and
    // leave the rest of it parsed as another output.
    expect(Object.values(healthOutputs(stopped)).every(value=>!/[\r\n]/.test(value))).toBe(true);
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

// The other way the pipeline stops. A run claims its jobs, the provider
// refuses every one, and the worker reports success because nothing about the
// run went wrong: green tick, empty pipeline, and the failure alarm silent
// because there is no failure. That is how it sat dead from 11 October, and
// how it stopped again on 14 October when the OpenAI credits ran out.
describe('saying so when the worker is getting nothing done',()=>{
  const emptyRun=message=>({outcome:'success',work:{outcome:'unproductive',attempted:10,succeeded:0,
    failed:10,providerParked:true,message}});
  const fullRun={outcome:'success',work:{outcome:'productive',attempted:10,succeeded:10,failed:0,
    providerParked:false,message:'10 jobs completed.'}};

  function twoEmptyRuns(){
    const worked=finishWorkerRun(beginWorkerRun(null,{runId:'1'},{at:'2026-10-14T10:15:00Z'}),fullRun,{at:'2026-10-14T10:20:00Z'});
    const first=finishWorkerRun(beginWorkerRun(worked,{runId:'2'},{at:'2026-10-14T10:45:00Z'}),emptyRun('no credits remaining'),{at:'2026-10-14T10:50:00Z'});
    return finishWorkerRun(beginWorkerRun(first,{runId:'3'},{at:'2026-10-14T13:45:00Z'}),emptyRun('no credits remaining'),{at:'2026-10-14T13:50:00Z'});
  }

  test('a run that gets nothing done still reports healthy, which is why this exists',()=>{
    const empty=twoEmptyRuns();
    expect(empty.status).toBe('healthy');
    expect(empty.consecutiveFailures).toBe(0);
    // The failure alarm reads those two and stays quiet, correctly.
    expect(healthOutputs(empty).consecutive_failures).toBe('0');
  });

  test('the empty runs are counted and dated, by the names the receipt uses',()=>{
    const empty=twoEmptyRuns();
    expect(healthOutputs(empty)).toEqual(expect.objectContaining({
      consecutive_unproductive:String(empty.consecutiveUnproductiveRuns),
      last_productive_at:empty.lastProductiveAt,
      unproductive_since:empty.lastUnproductive.since,
      provider_parked:'true',
    }));
    expect(Number(healthOutputs(empty).consecutive_unproductive)).toBeGreaterThanOrEqual(2);
    // Dated from the first empty run, not the latest, so the issue can say how
    // long nothing has been happening.
    expect(empty.lastUnproductive.since).toBe('2026-10-14T10:50:00Z');
  });

  test('a run that gets work through clears it, so the alarm closes',()=>{
    const recovered=finishWorkerRun(beginWorkerRun(twoEmptyRuns(),{runId:'4'},{at:'2026-10-14T19:00:00Z'}),fullRun,{at:'2026-10-14T19:05:00Z'});
    expect(healthOutputs(recovered).consecutive_unproductive).toBe('0');
  });

  test('an idle run leaves the count alone rather than reading as recovery',()=>{
    const idle={outcome:'success',work:{outcome:'idle',attempted:0,succeeded:0,failed:0,providerParked:false,message:'Nothing queued.'}};
    const after=finishWorkerRun(beginWorkerRun(twoEmptyRuns(),{runId:'5'},{at:'2026-10-14T16:45:00Z'}),idle,{at:'2026-10-14T16:50:00Z'});
    expect(healthOutputs(after).consecutive_unproductive).toBe(String(twoEmptyRuns().consecutiveUnproductiveRuns));
  });

  test('the provider message reaches the step outputs whole, in a heredoc',async()=>{
    const file=path.join(await fs.mkdtemp(path.join(os.tmpdir(),'orma-idle-')),'outputs.txt');
    const said='OpenAI request failed (429): You have no credits remaining.\nAdd credits to continue.';
    const health=finishWorkerRun(beginWorkerRun(twoEmptyRuns(),{runId:'6'},{at:'2026-10-14T16:45:00Z'}),emptyRun(said),{at:'2026-10-14T16:50:00Z'});
    const written=await announceHealth(health,{GITHUB_OUTPUT:file});
    const text=await fs.readFile(file,'utf8');
    expect(written.unproductive_message).toContain('no credits remaining');
    // A multi-line value has to be delimited or it breaks the output file.
    expect(text).toMatch(/unproductive_message<<ORMA_HEALTH_[0-9a-f]{32}\n/);
    expect(text).toContain('Add credits to continue.');
  });
});
