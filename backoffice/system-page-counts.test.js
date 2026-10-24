'use strict';

const {buildDashboardModel}=require('./dashboard-model');
const {summarisePipeline}=require('./workflows/pipeline-health');
const {PROCESSABLE_JOB_TYPES,heldWhilePaidOff}=require('./workflows/run-live-backoffice-worker');

/**
 * On 24 October the System page showed "49 agent jobs" while the worker held
 * 131 in the queue, 124 of them untouchable because paid research was off;
 * "0 needs you" above a trail marked You; and "intake active, admitted 10"
 * without saying those ten would wait. Each number was computed from the wrong
 * thing: the newest 100 jobs, the decision queue alone, and nothing at all.
 */
const queued=(n,fields)=>Array.from({length:n},(_,index)=>({
  id:`${fields.agentId||fields.jobType}-${index}`,status:'queued',createdAt:'2026-10-24T10:00:00Z',...fields}));

// The worker's summary, built by the worker's own functions with paid research off.
function workerSummary(jobs,paidResearchEnabled=false){
  return summarisePipeline(jobs,{at:'2026-10-24T12:45:00Z',processableJobTypes:PROCESSABLE_JOB_TYPES,
    paidResearchEnabled,heldWhilePaidOff});
}

const allJobs=[
  ...queued(102,{jobType:'trail-verification-specialist',agentId:'logistics'}),
  ...queued(7,{jobType:'trail-verification-specialist',agentId:'cartographer'}),
  ...queued(22,{jobType:'trail-claim-resolution',agentId:'logistics'}),
  {id:'old-handoff',jobType:'product-development-handoff',status:'ready-for-review'},
];

describe('the System page counts what the worker counts',()=>{
  test('agent jobs are the whole queue, with the held ones named',()=>{
    const pipelineHealth=workerSummary(allJobs);
    expect(pipelineHealth.working).toEqual(expect.objectContaining({queued:131,queuedHeld:124,paidResearchEnabled:false}));
    // The page itself only ever sees the newest 100 jobs.
    const model=buildDashboardModel({jobs:allJobs.slice(0,100),pipelineHealth});
    expect(model.summary.agentWork).toBe(131);
    expect(model.agentHeld).toBe(124);
  });

  test('nothing is called held while paid research is on',()=>{
    const model=buildDashboardModel({jobs:[],pipelineHealth:workerSummary(allJobs,true)});
    expect(model.summary.agentWork).toBe(131);
    expect(model.agentHeld).toBe(0);
  });

  test('without the worker summary the page falls back to the jobs it loaded',()=>{
    const model=buildDashboardModel({jobs:allJobs.slice(0,3)});
    expect(model.summary.agentWork).toBe(3);
    expect(model.agentHeld).toBe(0);
  });

  test('a stopped trail marked You is counted under Needs you, once',()=>{
    const model=buildDashboardModel({
      orchestration:{trails:[
        {candidateId:'patriotes',trailName:'Sentier des Patriotes',state:'blocked',stage:'source-exhausted',blockers:['not-closed-loop']},
        {candidateId:'gated',trailName:'Gated Trail',blockers:['water-unresolved']},
      ]},
      dossiers:{items:[{reviewId:'gate-1',candidateId:'gated',trailName:'Gated Trail',state:'awaiting-human',approvalAllowed:false}]},
      publication:{items:[]},jobs:[],history:[],
    });
    const you=model.blockingIssues.filter(item=>item.owner==='You').map(item=>item.title);
    expect(you).toEqual(['Gated Trail','Sentier des Patriotes']);
    // One evidence decision, plus the stopped trail -- the gated trail is not counted twice.
    expect(model.decisions).toHaveLength(1);
    expect(model.stuckOnYou).toBe(1);
    // And it is listed where the count points, so the card never reads 1 above an empty queue.
    expect(model.stuckItems.map(item=>item.title)).toEqual(['Sentier des Patriotes']);
    expect(model.summary.needsYou).toBe(2);
  });

  test('the intake card says admitted trails wait while paid research is off',()=>{
    const campaignHealth={status:'healthy',nextEligibleAt:'2026-10-25T08:30:00Z',lastResult:{admitted:10,remainingQueueable:27}};
    const paused=buildDashboardModel({campaignHealth,pipelineHealth:workerSummary(allJobs)}).campaignHealth;
    expect(paused.title).toBe('Trails are admitted, but research on them is paused');
    expect(paused.message).toContain('admitted 10 trail(s)');
    expect(paused.message).toContain('Paid research is off');
    const running=buildDashboardModel({campaignHealth,pipelineHealth:workerSummary(allJobs,true)}).campaignHealth;
    expect(running.title).toBe('Catalogue admission is automatic and capacity-limited');
    expect(running.message).not.toContain('Paid research');
    // An older summary that never recorded the switch says nothing about it.
    expect(buildDashboardModel({campaignHealth}).campaignHealth.message).not.toContain('Paid research');
  });
});
