const {summarisePipeline}=require('./workflows/pipeline-health');
const {workMessage,workOutcome}=require('./workflows/worker-productivity');

// Two worker runs came back "This run had no agent work to pick up." beside a
// pipeline summary reporting 103 queued. Both numbers were right. claimJob
// refuses a job whose notBefore has not passed, and the summary counted only
// status, so a queue of retries waiting out their backoff read exactly like a
// queue nobody had picked up. It sent me looking for a stalled worker twice.
//
// The backoff that filled it: 30 minutes per provider outage, set on every
// failure for as long as the OpenAI credits were out.
const AT='2026-10-06T12:00:00.000Z';
const minutes=n=>new Date(Date.parse(AT)+n*60000).toISOString();
const job=(over={})=>({jobType:'trail-claim-resolution',status:'queued',createdAt:AT,...over});

describe('a queued job is not always a job that can be taken', () => {
  test('queued splits into what is due and what is waiting on a clock', () => {
    const pipeline=summarisePipeline([
      job(), job(),
      job({notBefore:minutes(20)}), job({notBefore:minutes(5)}), job({notBefore:minutes(45)}),
    ],{at:AT,laneRuns:()=>true});
    expect(pipeline.working.queued).toBe(5);
    expect(pipeline.working.queuedDue).toBe(2);
    expect(pipeline.working.queuedWaitingBackoff).toBe(3);
    // The soonest one, so a reader knows whether to wait or to look deeper.
    expect(pipeline.working.nextDueAt).toBe(minutes(5));
  });

  test('a notBefore already passed is due, not waiting', () => {
    const pipeline=summarisePipeline([job({notBefore:minutes(-10)})],{at:AT,laneRuns:()=>true});
    expect(pipeline.working.queuedDue).toBe(1);
    expect(pipeline.working.queuedWaitingBackoff).toBe(0);
    expect(pipeline.working.nextDueAt).toBeNull();
  });

  test('the split reaches each lane too', () => {
    const pipeline=summarisePipeline([
      job({jobType:'trail-claim-resolution'}),
      job({jobType:'trail-verification-specialist',notBefore:minutes(30)}),
    ],{at:AT,laneRuns:()=>true});
    const lane=id=>pipeline.lanes.find(entry=>entry.jobType===id);
    expect(lane('trail-claim-resolution').queuedDue).toBe(1);
    expect(lane('trail-verification-specialist').queuedWaitingBackoff).toBe(1);
  });

  test('an idle run says the queue is waiting, not that it is empty', () => {
    const pipeline=summarisePipeline([job({notBefore:minutes(12)}),job({notBefore:minutes(40)})],
      {at:AT,laneRuns:()=>true});
    const work={attempted:0,succeeded:0,failed:0,reasons:[]};
    expect(workOutcome(work)).toBe('idle');
    const message=workMessage(work,pipeline);
    expect(message).toMatch(/waiting out a retry backoff/);
    expect(message).toMatch(/2 jobs queued/);
    expect(message).not.toBe('This run had no agent work to pick up.');
  });

  test('a genuinely empty queue still says so plainly', () => {
    const pipeline=summarisePipeline([],{at:AT,laneRuns:()=>true});
    const work={attempted:0,succeeded:0,failed:0,reasons:[]};
    expect(workMessage(work,pipeline)).toBe('This run had no agent work to pick up.');
    // And with no pipeline at all, the old message is the safe answer.
    expect(workMessage(work)).toBe('This run had no agent work to pick up.');
  });

  test('work that did run is described as before', () => {
    const pipeline=summarisePipeline([job({notBefore:minutes(30)})],{at:AT,laneRuns:()=>true});
    expect(workMessage({attempted:7,succeeded:7,failed:0,reasons:[]},pipeline)).toBe('7 jobs completed.');
  });
});
