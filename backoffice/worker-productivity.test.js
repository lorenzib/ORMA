'use strict';

const {summariseWorkAttempted,workOutcome,workMessage,attempts}=require('./workflows/worker-productivity');
const {beginWorkerRun,finishWorkerRun}=require('./workflows/worker-health');
const {buildDashboardModel}=require('./dashboard-model');
const {workInput}=require('./cli/record-worker-health');

// The exact string the OpenAI API returned for five days in September 2026.
const NO_CREDITS='OpenAI request failed (429): You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.';
const refused=(jobId,agentId)=>({jobId,agentId,status:'retry-or-blocked',error:NO_CREDITS});

describe('a worker run that finishes every step and completes no work',()=>{
  test('the September outage reads as unproductive and provider-parked, not as health',()=>{
    const summary=summariseWorkAttempted({
      specialistJobs:[refused('a','terrainPoi'),refused('b','logistics'),refused('c','regulatoryRanger')],
      // Reviews are not job attempts: a queue with nothing in it must not make
      // a run look productive, and a processed review must not mask refusals.
      dossierReviews:[{reviewId:'r1',status:'processed'}],
      reviews:[],jobs:[],
    });
    expect(summary).toEqual(expect.objectContaining({attempted:3,succeeded:0,failed:3,providerParked:true}));
    expect(workOutcome(summary)).toBe('unproductive');
    expect(workMessage(summary)).toContain('none completed');
    expect(workMessage(summary)).toContain('no decision here will clear it');
  });

  test('one completed job is enough to be productive, because the queue is moving',()=>{
    const summary=summariseWorkAttempted({specialistJobs:[refused('a','logistics'),{jobId:'b',agentId:'terrainPoi',status:'completed'}]});
    expect(summary).toEqual(expect.objectContaining({attempted:2,succeeded:1,failed:1}));
    expect(workOutcome(summary)).toBe('productive');
    expect(workMessage(summary)).toBe('1 job completed and 1 failed.');
  });

  test('an empty queue is idle, never degraded',()=>{
    const summary=summariseWorkAttempted({specialistJobs:[],reviews:[],jobs:[],editorialFirstPass:[]});
    expect(summary.attempted).toBe(0);
    expect(workOutcome(summary)).toBe('idle');
  });

  test('a lane nobody registered still counts, because entries are found by shape',()=>{
    const found=attempts({someLaneAddedNextYear:[{jobId:'new-1',status:'retry-or-blocked',error:'boom'}]});
    expect(found).toHaveLength(1);
    expect(workOutcome(summariseWorkAttempted({someLaneAddedNextYear:[{jobId:'new-1',status:'retry-or-blocked',error:'boom'}]}))).toBe('unproductive');
  });

  test('failures that are not the provider are reported as work faults, not as parked',()=>{
    const summary=summariseWorkAttempted({specialistJobs:[{jobId:'a',status:'retry-or-blocked',error:'Production trail not found: osm-1'}]});
    expect(summary.providerParked).toBe(false);
    expect(workMessage(summary)).not.toContain('no decision here will clear it');
    expect(workMessage(summary)).toContain('Production trail not found');
  });

  test('community hazard vetting counts even though it reports per report',()=>{
    const summary=summariseWorkAttempted({communityHazards:{vetted:[{reportId:'h1',status:'vetting-failed',error:NO_CREDITS}]}});
    expect(summary).toEqual(expect.objectContaining({attempted:1,failed:1,providerParked:true}));
  });
});

describe('the health receipt separates "the worker ran" from "work got done"',()=>{
  const unproductiveRun=(previous,at)=>finishWorkerRun(
    beginWorkerRun(previous,{runId:at,workflowRunUrl:`https://github.com/lorenzib/ORMA/actions/runs/${at}`},{at}),
    {outcome:'degraded',failureStage:'agent-work',
      work:{outcome:'unproductive',attempted:10,succeeded:0,failed:10,providerParked:true,message:'Every job this run attempted failed — 10 jobs, none completed.'}},
    {at});

  test('degraded is its own status: not healthy, and not a failure either',()=>{
    const first=unproductiveRun({lastProductiveAt:'2026-09-12T03:34:00Z'},'2026-09-12T06:41:00Z');
    expect(first.status).toBe('degraded');
    // The old code had only success/blocked/failure, so this run was 'healthy'.
    expect(first.status).not.toBe('healthy');
    // Nothing crashed, so the failure alarm must stay quiet and keep its count.
    expect(first.consecutiveFailures).toBe(0);
    expect(first.lastFailure).toBeNull();
    expect(first.lastProductiveAt).toBe('2026-09-12T03:34:00Z');
  });

  test('the streak dates from the first refused run, not the latest',()=>{
    let health={lastProductiveAt:'2026-09-12T03:34:00Z'};
    for(const at of ['2026-09-12T06:41:00Z','2026-09-12T09:31:00Z','2026-09-12T12:35:00Z']) health=unproductiveRun(health,at);
    expect(health.consecutiveUnproductiveRuns).toBe(3);
    expect(health.lastUnproductive.since).toBe('2026-09-12T06:41:00Z');
    expect(health.lastUnproductive.observedAt).toBe('2026-09-12T12:35:00Z');
    expect(health.lastUnproductive.providerParked).toBe(true);
  });

  test('an idle run is evidence of nothing and moves neither counter',()=>{
    const stalled=unproductiveRun({lastProductiveAt:'2026-09-12T03:34:00Z'},'2026-09-12T06:41:00Z');
    const idle=finishWorkerRun(beginWorkerRun(stalled,{runId:'idle'},{at:'2026-09-12T09:00:00Z'}),
      {outcome:'success',work:{outcome:'idle',attempted:0,succeeded:0,failed:0,message:'This run had no agent work to pick up.'}},{at:'2026-09-12T09:00:00Z'});
    expect(idle.consecutiveUnproductiveRuns).toBe(1);
    expect(idle.lastProductiveAt).toBe('2026-09-12T03:34:00Z');
  });

  test('one completed job clears the streak and the standing explanation',()=>{
    let health={lastProductiveAt:'2026-09-12T03:34:00Z'};
    for(const at of ['2026-09-12T06:41:00Z','2026-09-12T09:31:00Z']) health=unproductiveRun(health,at);
    const recovered=finishWorkerRun(beginWorkerRun(health,{runId:'ok'},{at:'2026-09-17T12:00:00Z'}),
      {outcome:'success',work:{outcome:'productive',attempted:10,succeeded:10,failed:0,message:'10 jobs completed.'}},{at:'2026-09-17T12:00:00Z'});
    expect(recovered).toEqual(expect.objectContaining({status:'healthy',consecutiveUnproductiveRuns:0,lastUnproductive:null,lastProductiveAt:'2026-09-17T12:00:00Z'}));
  });

  test('a genuine failure still outranks it and keeps its own diagnostics',()=>{
    const failed=finishWorkerRun(beginWorkerRun(null,{runId:'1'},{at:'2026-09-17T12:00:00Z'}),
      {outcome:'failure',failureStage:'website-validation',failureMessage:'Tests failed.',
        work:{outcome:'unproductive',attempted:4,succeeded:0,failed:4,message:'Every job this run attempted failed.'}},{at:'2026-09-17T12:02:00Z'});
    expect(failed.status).toBe('failed');
    expect(failed.consecutiveFailures).toBe(1);
    // Still recorded, so the desk can say the queue stalled as well as crashed.
    expect(failed.consecutiveUnproductiveRuns).toBe(1);
  });

  test('the CLI reads the work outcome the worker handed across the step boundary',()=>{
    expect(workInput({})).toBeNull();
    expect(workInput({ORMA_WORKER_WORK_OUTCOME:'unproductive',ORMA_WORKER_WORK_ATTEMPTED:'10',ORMA_WORKER_WORK_SUCCEEDED:'0',
      ORMA_WORKER_WORK_FAILED:'10',ORMA_WORKER_WORK_PROVIDER_PARKED:'true',ORMA_WORKER_WORK_MESSAGE:'Every job failed.'}))
      .toEqual({outcome:'unproductive',attempted:10,succeeded:0,failed:10,providerParked:true,message:'Every job failed.'});
  });
});

describe('the desk says so out loud',()=>{
  const card=(artifact,nowMs)=>buildDashboardModel({orchestration:{trails:[]},dossiers:{items:[]},execution:{outputs:[]},
    publication:{items:[]},history:[],workerHealth:artifact,nowMs}).workerHealth;

  test('five days of refusals render as a dated, explained stall',()=>{
    const health=card({status:'degraded',completedAt:'2026-09-17T09:35:00Z',lastSuccessfulAt:'2026-09-17T09:35:00Z',
      lastProductiveAt:'2026-09-12T03:34:00Z',consecutiveUnproductiveRuns:40,
      lastUnproductive:{since:'2026-09-12T06:41:00Z',providerParked:true,message:'The model provider refused every request.',
        workflowRunUrl:'https://github.com/lorenzib/ORMA/actions/runs/35205727789'}},Date.parse('2026-09-17T09:40:00Z'));
    expect(health.state).toBe('degraded');
    expect(health.title).toBe('Agents cannot reach the model provider');
    expect(health.meta).toContain('40 runs in a row');
    // Days, not 122 hours.
    expect(health.meta).toContain('over the last 5 days');
    expect(health.runUrl).toBe('https://github.com/lorenzib/ORMA/actions/runs/35205727789');
  });

  test('a fresh successful run is still plainly healthy',()=>{
    const health=card({status:'healthy',completedAt:'2026-09-17T09:35:00Z',lastSuccessfulAt:'2026-09-17T09:35:00Z',
      lastProductiveAt:'2026-09-17T09:35:00Z',consecutiveUnproductiveRuns:0,
      expectedIntervalMinutes:180,delayAfterMinutes:210,staleAfterMinutes:390},Date.parse('2026-09-17T09:40:00Z'));
    expect(health.state).toBe('healthy');
  });
});
