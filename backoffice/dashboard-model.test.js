'use strict';

const {buildDashboardModel}=require('./dashboard-model');

describe('CEO dashboard workflow model',()=>{
  test('completed content approval leaves the CEO queue and a queued release approval stays owned by the worker',()=>{
    const model=buildDashboardModel({
      orchestration:{trails:[
        {candidateId:'trail-copy',trailName:'Copy Trail',blockers:[]},
        {candidateId:'trail-worker',trailName:'Worker Trail',blockers:[]},
        {candidateId:'trail-pr',trailName:'PR Trail',blockers:[]},
      ]},
      dossiers:{items:[]},execution:{outputs:[{candidateId:'trail-worker',status:'ready-for-review',result:{title:'Worker Trail'}}]},
      publication:{items:[
        {candidateId:'trail-copy',targetTrailId:'copy',state:'waiting-content-approvals',missingApprovals:['asset-and-licensing-approval']},
        {candidateId:'trail-worker',targetTrailId:'worker',state:'ready-for-publication-preview',missingApprovals:[]},
        {candidateId:'trail-pr',targetTrailId:'pr',state:'ready-for-publication-preview',missingApprovals:[]},
      ]},
      history:[{id:'worker-approval',stream:'publication',candidateId:'trail-worker',action:'approve-for-pr-creation',status:'queued',submittedAt:'2026-08-19T18:00:00Z'}],
      publicationRequests:{requests:[{id:'pr-approval',candidateId:'trail-pr',targetTrailId:'pr',status:'pull-request-opened',reviewedAt:'2026-08-19T17:00:00Z',acknowledgedAt:'2026-08-19T17:05:00Z',pullRequestUrl:'https://github.com/orma/pr/1'}]},
      jobs:[],
    });
    expect(model.decisions.map(item=>item.kind)).toEqual(['content','pull-request']);
    expect(model.decisions.some(item=>item.title==='Worker Trail')).toBe(false);
    expect(model.publicationInFlight).toBe(1);
    expect(model.summary).toEqual({needsYou:2,agentWork:0,blockers:0,prsReady:1});
    expect(model.activity).toEqual(expect.arrayContaining([expect.objectContaining({status:'queued',message:expect.stringContaining('next successful run')})]));
  });

  test('each evidence decision names its trail and explains the automatic handoff',()=>{
    const model=buildDashboardModel({orchestration:{trails:[{candidateId:'trail-a',trailName:'Trail A',blockers:['not-closed-loop']}]},dossiers:{items:[{reviewId:'gate-a',candidateId:'trail-a',trailName:'Trail A',state:'awaiting-human',approvalAllowed:false}]},publication:{items:[]},jobs:[],history:[]});
    expect(model.decisions[0]).toEqual(expect.objectContaining({kind:'evidence',title:'Trail A',href:'trail-dossier-desk.html#review-gate-a'}));
    expect(model.decisions[0].next).toContain('returns to this desk');
    expect(model.blockerCount).toBe(1);
  });

  test('a just-submitted decision leaves the CEO queue immediately while its receipt remains visible',()=>{
    const model=buildDashboardModel({
      orchestration:{trails:[{candidateId:'trail-a',trailName:'Trail A',blockers:[]}]},
      dossiers:{items:[{reviewId:'gate-a',candidateId:'trail-a',trailName:'Trail A',state:'awaiting-human',approvalAllowed:true}]},
      publication:{items:[]},jobs:[],
      history:[{id:'review-a',stream:'dossier',reviewId:'gate-a',candidateId:'trail-a',action:'request-revision',status:'queued',submittedAt:'2026-08-19T18:10:00Z'}],
    });
    expect(model.decisions).toHaveLength(0);
    expect(model.handoffsInFlight).toBe(1);
    expect(model.activity[0]).toEqual(expect.objectContaining({status:'queued',message:expect.stringContaining('next successful run')}));
    expect(model.pipeline[0]).toEqual(expect.objectContaining({owner:'System',status:'1 decision being handed off'}));
  });

  test('content receipts recover the exact trail name from their saved job IDs',()=>{
    const model=buildDashboardModel({
      orchestration:{trails:[{candidateId:'lago-braies',trailName:'Lago di Braies',blockers:[]}]},
      dossiers:{items:[]},publication:{items:[]},jobs:[],
      history:[{id:'content-a',stream:'content',status:'processed',submittedAt:'2026-08-19T18:10:00Z',decisions:[{jobId:'verified-lago-braies-copy',action:'approve'}]}],
    });
    expect(model.activity[0]).toEqual(expect.objectContaining({candidateId:'lago-braies',title:'Lago di Braies'}));
  });

  test('a publication failure is durable, visible and does not reopen the approval gate',()=>{
    const model=buildDashboardModel({
      orchestration:{trails:[{candidateId:'trail-a',trailName:'Trail A',blockers:[]}]},dossiers:{items:[]},execution:{outputs:[]},jobs:[],history:[],
      publication:{items:[{candidateId:'trail-a',targetTrailId:'trail-a',state:'ready-for-publication-preview',missingApprovals:[]}]},
      publicationRequests:{requests:[{id:'release-a',candidateId:'trail-a',targetTrailId:'trail-a',status:'publication-failed',failureStage:'website-validation',failureMessage:'Generated-site tests failed.',workflowRunUrl:'https://github.com/orma/actions/runs/1',failedAt:'2026-08-19T20:31:00Z'}]},
    });
    expect(model.releaseItems).toHaveLength(0);
    expect(model.automationFailures).toEqual([expect.objectContaining({candidateId:'trail-a',failureStage:'website-validation'})]);
    expect(model.summary).toEqual({needsYou:0,agentWork:0,blockers:1,prsReady:0});
    expect(model.activity[0]).toEqual(expect.objectContaining({status:'publication-failed',message:expect.stringContaining('approval is retained')}));
    expect(model.pipeline[3].status).toContain('blocked with a saved failure receipt');
  });

  test.each([
    ['healthy',{status:'healthy',lastSuccessfulAt:'2026-08-19T20:58:00Z'},'healthy'],
    ['running',{status:'running',runId:'123',startedAt:'2026-08-19T20:56:00Z',workflowRunUrl:'https://github.com/orma/actions/runs/123'},'running'],
    ['delayed',{status:'healthy',lastSuccessfulAt:'2026-08-19T20:42:00Z'},'delayed'],
    ['stale',{status:'healthy',lastSuccessfulAt:'2026-08-19T20:20:00Z'},'stale'],
    ['stuck run',{status:'running',runId:'123',startedAt:'2026-08-19T20:20:00Z'},'stale'],
    ['failed',{status:'failed',completedAt:'2026-08-19T20:59:00Z',consecutiveFailures:2,lastFailure:{stage:'pull-request-creation',message:'GitHub denied PR creation.',workflowRunUrl:'https://github.com/orma/actions/runs/123'}},'failed'],
  ])('classifies %s worker health honestly',(_label,workerHealth,state)=>{
    const model=buildDashboardModel({orchestration:{trails:[]},dossiers:{items:[]},publication:{items:[]},jobs:[],history:[],workerHealth,nowMs:new Date('2026-08-19T21:00:00Z').getTime()});
    expect(model.workerHealth.state).toBe(state);
    if(state==='failed')expect(model.workerHealth).toEqual(expect.objectContaining({consecutiveFailures:2,runUrl:'https://github.com/orma/actions/runs/123'}));
  });

  test('shows the durable catalogue campaign result and its next due check',()=>{
    const model=buildDashboardModel({campaignHealth:{status:'healthy',nextEligibleAt:'2026-08-21T06:16:00Z',workflowRunUrl:'https://github.com/orma/actions/runs/456',lastResult:{admitted:2,remainingQueueable:8}},nowMs:new Date('2026-08-20T07:00:00Z').getTime()});
    expect(model.campaignHealth).toEqual(expect.objectContaining({state:'healthy',runUrl:'https://github.com/orma/actions/runs/456',message:expect.stringContaining('admitted 2 trail(s)')}));
  });

  test('counts autonomous resolution and first-pass editorial jobs as visible agent work',()=>{
    const model=buildDashboardModel({jobs:[
      {id:'resolution-1',jobType:'trail-claim-resolution',status:'queued',candidateId:'trail-a'},
      {id:'copy-1',jobType:'verified-trail-editorial-first-pass',status:'running',candidateId:'trail-a'},
    ]});
    expect(model.summary.agentWork).toBe(2);
    expect(model.pipeline[1].status).toBe('2 jobs running or queued');
  });
});
