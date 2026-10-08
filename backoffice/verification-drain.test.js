'use strict';

const fs=require('fs');
const path=require('path');
const {FirestoreUsageMeter}=require('./services/firestore-usage');
const {drainVerificationQueue,quotaExhausted,budgetsFrom,CLEAN_STOPS,DEFAULT_BUDGETS}=require('./workflows/drain-verification-queue');
const {summaryMarkdown}=require('./cli/drain-verification-queue');
const {workerOptions,reportWork}=require('./cli/live-worker');
const {workReceipt}=require('./workflows/worker-health');
const {workInput}=require('./cli/record-worker-health');

// A pass result the way the worker returns it: lanes are arrays of entries
// with a jobId, and a failed one says 'retry-or-blocked'.
function pass(jobs,{failed=0,error}={}){
  const specialistJobs=[];
  for(let index=0;index<jobs;index+=1)specialistJobs.push({jobId:`job-${index}`,status:index<failed?'retry-or-blocked':'completed',
    ...(index<failed&&error?{error}:{})});
  return {specialistJobs,gateDispatches:[],completedAt:'2026-10-07T10:00:00.000Z'};
}

// A clock the test moves by hand, so elapsed time is what a pass took, not how
// often the loop looked at the time.
function makeClock(){let t=Date.UTC(2026,9,7,10,0,0);return {now:()=>t,advance:(ms)=>{t+=ms;}};}
function clock(){return makeClock().now;}

describe('draining the verification queue',()=>{
  test('runs passes until two in a row claim nothing, and reports the spend per pass',async()=>{
    const usage=new FirestoreUsageMeter();
    const results=[pass(10),pass(4),pass(0),pass(0),pass(10)];
    const ledger=await drainVerificationQueue({usage,now:clock(),runPass:async(index)=>{
      usage.read(100*index).write(10);return results[index-1];
    }});
    expect(ledger.stoppedBecause).toBe('queue-idle');
    expect(ledger.totals).toEqual({passes:4,reads:1000,writes:40,attempted:14,succeeded:14,failed:0});
    expect(ledger.passes.map(item=>[item.index,item.outcome,item.reads])).toEqual([[1,'productive',100],[2,'productive',200],[3,'idle',300],[4,'idle',400]]);
    expect(ledger.averages).toMatchObject({passes:4,readsPerPass:250,writesPerPass:10,readsPerJob:71});
    expect(CLEAN_STOPS).toContain('queue-idle');
  });

  test('an idle pass between productive ones does not stop it',async()=>{
    const usage=new FirestoreUsageMeter();
    const results=[pass(3),pass(0),pass(3),pass(0),pass(0)];
    const ledger=await drainVerificationQueue({usage,now:clock(),runPass:async(index)=>results[index-1]});
    expect(ledger.totals.passes).toBe(5);
    expect(ledger.totals.succeeded).toBe(6);
  });

  test('stops before a pass that would start past the read budget',async()=>{
    const usage=new FirestoreUsageMeter();
    let passes=0;
    const ledger=await drainVerificationQueue({usage,now:clock(),readBudget:250,runPass:async()=>{passes+=1;usage.read(100);return pass(5);}});
    expect(passes).toBe(3);
    expect(ledger.stoppedBecause).toBe('read-budget');
    expect(ledger.totals.reads).toBe(300);
  });

  test('stops at the write budget and the clock budget too',async()=>{
    const usage=new FirestoreUsageMeter();
    const byWrites=await drainVerificationQueue({usage,now:clock(),writeBudget:2,runPass:async()=>{usage.write(1);return pass(1);}});
    expect(byWrites.stoppedBecause).toBe('write-budget');
    expect(byWrites.totals.passes).toBe(2);
    // Each pass takes a minute; a 3-minute budget starts three passes and refuses the fourth.
    const ticking=makeClock();
    const byClock=await drainVerificationQueue({usage:new FirestoreUsageMeter(),now:ticking.now,maxMinutes:3,runPass:async()=>{ticking.advance(60_000);return pass(1);}});
    expect(byClock.stoppedBecause).toBe('time-budget');
    expect(byClock.totals.passes).toBe(3);
    expect(byClock.passes.every(item=>item.durationMs===60_000)).toBe(true);
    expect(byClock.durationMs).toBe(180_000);
  });

  test('a Firestore quota refusal inside a pass stops the loop, named',async()=>{
    const usage=new FirestoreUsageMeter();
    const results=[pass(5),pass(5,{failed:5,error:'8 RESOURCE_EXHAUSTED: Quota exceeded.'})];
    const ledger=await drainVerificationQueue({usage,now:clock(),runPass:async(index)=>results[index-1]});
    expect(ledger.stoppedBecause).toBe('firestore-quota');
    expect(ledger.totals.passes).toBe(2);
    expect(CLEAN_STOPS).not.toContain('firestore-quota');
  });

  test('a pass that throws is recorded and stops the loop; a quota throw is still named',async()=>{
    const usage=new FirestoreUsageMeter();
    const thrown=await drainVerificationQueue({usage,now:clock(),runPass:async()=>{throw new Error('boom');}});
    expect(thrown.stoppedBecause).toBe('pass-error');
    expect(thrown.passes[0]).toMatchObject({index:1,error:'boom'});
    const quota=await drainVerificationQueue({usage,now:clock(),runPass:async()=>{throw Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded.'),{code:8});}});
    expect(quota.stoppedBecause).toBe('firestore-quota');
  });

  test('a provider outage parks the drain instead of burning passes against it',async()=>{
    const usage=new FirestoreUsageMeter();
    const ledger=await drainVerificationQueue({usage,now:clock(),runPass:async()=>pass(3,{failed:3,error:'429 insufficient_quota: You exceeded your current quota'})});
    expect(ledger.stoppedBecause).toBe('provider-parked');
    expect(ledger.totals.passes).toBe(1);
  });

  test('quota detection reads results and errors, not just messages',()=>{
    expect(quotaExhausted({gateDispatches:[{status:'blocked',error:'8 RESOURCE_EXHAUSTED: Quota exceeded.'}]})).toBe(true);
    expect(quotaExhausted(new Error('Quota exceeded'))).toBe(true);
    expect(quotaExhausted(pass(3))).toBe(false);
    expect(quotaExhausted(null)).toBe(false);
  });

  test('budgets fall back to the defaults when unset or nonsense',()=>{
    expect(budgetsFrom({})).toEqual(DEFAULT_BUDGETS);
    expect(budgetsFrom({readBudget:'500',maxMinutes:-1,writeBudget:undefined})).toMatchObject({readBudget:500,maxMinutes:DEFAULT_BUDGETS.maxMinutes,writeBudget:DEFAULT_BUDGETS.writeBudget});
  });

  test('the run summary says why it stopped and what each pass cost',async()=>{
    const usage=new FirestoreUsageMeter();
    const ledger=await drainVerificationQueue({usage,now:clock(),runPass:async()=>{usage.read(50);return pass(0);}});
    const markdown=summaryMarkdown(ledger);
    expect(markdown).toContain('stopped: queue-idle');
    expect(markdown).toContain('| 1 | idle | 0/0 | 50 | 0 |');
  });
});

describe('the drain runs the worker pass, not a copy of it',()=>{
  test('the worker CLI and the drain read one option builder',()=>{
    const env={GITHUB_RUN_ID:'9',GITHUB_REPOSITORY:'lorenzib/ORMA',ORMA_SPECIALIST_LIMIT:'7',ORMA_CAMPAIGN_AUTOMATION_ENABLED:'true',ORMA_GATE_DISPATCH_ENABLED:'false'};
    const options=workerOptions(env,{workerId:'github-drain-9-1'});
    expect(options).toMatchObject({workerId:'github-drain-9-1',runId:'9',specialistLimit:7,campaignEnabled:true,gateDispatchEnabled:false,
      campaignCapacity:15,gateAdjudicationLimit:2,workflowRunUrl:'https://github.com/lorenzib/ORMA/actions/runs/9'});
    expect(workerOptions(env).workerId).toBe('github-9-1');
    const cli=fs.readFileSync(path.join(__dirname,'cli/drain-verification-queue.js'),'utf8');
    expect(cli).toContain("workerOptions");
    // The intent, asserted in parts rather than as one literal: each pass runs
    // the worker's own pass against a real store that shares the meter. The
    // completed-job cache is also handed in, which is why this is no longer a
    // single exact string.
    expect(cli).toMatch(/runLiveBackofficeWorker\(new FirestoreBackofficeStore\(\{usage[,}]/);
    expect(cli).toContain('jobCache:completedJobs');
  });

  test('the workflow shares the worker lock, carries both budgets and publishes nothing',()=>{
    const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/orma-verification-drain.yml'),'utf8');
    expect(workflow).toContain('group: orma-backoffice-worker');
    expect(workflow).toContain('ORMA_DRAIN_READ_BUDGET');
    expect(workflow).toContain('ORMA_DRAIN_WRITE_BUDGET');
    expect(workflow).toContain('ORMA_DRAIN_MAX_MINUTES');
    expect(workflow).toContain('npm run backoffice:worker:drain');
    expect(workflow).toMatch(/permissions:\n  contents: read/);
    expect(workflow).not.toContain('gh pr create');
    expect(workflow).not.toContain('materialize-publications');
    const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8'));
    expect(pkg.scripts['backoffice:worker:drain']).toBe('node backoffice/cli/drain-verification-queue.js');
  });
});

describe('a pass reports what it cost',()=>{
  test('the worker hands reads and writes across the step boundary and the receipt keeps them',async()=>{
    const written=[];
    const env={GITHUB_OUTPUT:path.join(require('os').tmpdir(),`orma-output-${process.pid}.txt`)};
    fs.writeFileSync(env.GITHUB_OUTPUT,'');
    await reportWork({attempted:10,succeeded:9,failed:1,providerParked:false,reasons:[]},env,null,{reads:1234,writes:56});
    const output=fs.readFileSync(env.GITHUB_OUTPUT,'utf8');
    expect(output).toContain('work_reads=1234');
    expect(output).toContain('work_writes=56');
    fs.unlinkSync(env.GITHUB_OUTPUT);
    const input=workInput({ORMA_WORKER_WORK_OUTCOME:'productive',ORMA_WORKER_WORK_ATTEMPTED:'10',ORMA_WORKER_WORK_SUCCEEDED:'9',ORMA_WORKER_WORK_FAILED:'1',
      ORMA_WORKER_WORK_READS:'1234',ORMA_WORKER_WORK_WRITES:'56'});
    expect(input.usage).toEqual({reads:1234,writes:56});
    expect(workReceipt({work:input})).toMatchObject({attempted:10,usage:{reads:1234,writes:56}});
    // A pass from before the meter has no usage, and that is not zero.
    expect(workInput({ORMA_WORKER_WORK_OUTCOME:'idle'}).usage).toBeUndefined();
    expect(workReceipt({work:{outcome:'idle'}}).usage).toBeUndefined();
    void written;
  });
});
