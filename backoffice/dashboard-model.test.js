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

  test('a successful deployment clears the PR gate and leaves a live publication receipt',()=>{
    const model=buildDashboardModel({
      orchestration:{trails:[{candidateId:'trail-a',trailName:'Trail A',blockers:[]}]},dossiers:{items:[]},execution:{outputs:[]},jobs:[],history:[],
      publication:{items:[{candidateId:'trail-a',targetTrailId:'trail-a',state:'published',missingApprovals:[]}]},
      publicationRequests:{requests:[{id:'release-a',candidateId:'trail-a',targetTrailId:'trail-a',status:'published',publicationCommit:'abcdef123456',deployedAt:'2026-08-20T10:00:00Z',deploymentRunUrl:'https://github.com/orma/actions/runs/2',publicUrl:'https://www.app-orma.com/trail.html?id=trail-a'}]},
    });
    expect(model.decisions).toHaveLength(0);expect(model.prItems).toHaveLength(0);expect(model.summary.prsReady).toBe(0);
    expect(model.activity[0]).toEqual(expect.objectContaining({status:'published',publicUrl:'https://www.app-orma.com/trail.html?id=trail-a',message:expect.stringContaining('commit abcdef1')}));
  });

  test.each([
    ['healthy',{status:'healthy',lastSuccessfulAt:'2026-08-19T20:58:00Z'},'healthy'],
    ['running',{status:'running',runId:'123',startedAt:'2026-08-19T20:56:00Z',workflowRunUrl:'https://github.com/orma/actions/runs/123'},'running'],
    ['delayed',{status:'healthy',lastSuccessfulAt:'2026-08-19T20:14:00Z'},'delayed'],
    ['stale',{status:'healthy',lastSuccessfulAt:'2026-08-19T19:29:00Z'},'stale'],
    ['stuck run',{status:'running',runId:'123',startedAt:'2026-08-19T19:29:00Z'},'stale'],
    ['failed',{status:'failed',completedAt:'2026-08-19T20:59:00Z',consecutiveFailures:2,lastFailure:{stage:'pull-request-creation',message:'GitHub denied PR creation.',workflowRunUrl:'https://github.com/orma/actions/runs/123'}},'failed'],
    ['publication blocked',{status:'blocked',completedAt:'2026-08-19T20:59:00Z',publicationGate:{message:'Validate ORMA failed. Queue and agent work may continue; approvals stay saved.',validationRunUrl:'https://github.com/orma/actions/runs/456'}},'blocked'],
  ])('classifies %s worker health honestly',(_label,workerHealth,state)=>{
    const model=buildDashboardModel({orchestration:{trails:[]},dossiers:{items:[]},publication:{items:[]},jobs:[],history:[],workerHealth,nowMs:new Date('2026-08-19T21:00:00Z').getTime()});
    expect(model.workerHealth.state).toBe(state);
    if(state==='failed')expect(model.workerHealth).toEqual(expect.objectContaining({consecutiveFailures:2,runUrl:'https://github.com/orma/actions/runs/123'}));
    if(state==='blocked')expect(model.workerHealth).toEqual(expect.objectContaining({label:'Publishing paused',runUrl:'https://github.com/orma/actions/runs/456'}));
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

  test('hides paused Safety Library packets from the executive Editorial queue',()=>{
    const safety={generatedAt:'2026-08-25T08:00:00Z',subject:{type:'guide',id:'paw-protection',sourceRef:'guides/paw-protection.html'},outputs:[{status:'ready-for-review'}]};
    const ordinary={generatedAt:'2026-08-25T08:00:00Z',subject:{type:'guide',id:'dog-friendly-hikes-val-gardena',sourceRef:'guides/dog-friendly-hikes-val-gardena.html'},outputs:[{status:'ready-for-review'}]};
    const model=buildDashboardModel({editorialPackets:[safety,ordinary],strategyStatus:{summary:{editorialStatus:'active'}},jobs:[]});
    expect(model.editorialItems).toEqual([ordinary]);expect(model.editorialProgress).toEqual(expect.objectContaining({active:1,waiting:1,pausedSafetyLibrary:true}));
  });



  test('keeps preserved Editorial and Analyst work out of the MVP decision queue',()=>{
    const model=buildDashboardModel({
      strategyStatus:{summary:{editorialStatus:'parked for MVP; existing packets preserved',productStatus:'parked for MVP; existing ideas preserved'}},
      editorialPackets:[{generatedAt:'2026-08-20T12:00:00Z',subject:{type:'page',id:'privacy'},outputs:[{status:'ready-for-review'}]}],
      productIdeas:{ideas:[{id:'saved-idea',title:'Saved idea'}]},
      jobs:[{id:'old-analyst',jobType:'hosted-product-design',status:'queued'}],
    });
    expect(model.decisions.some(item=>['editorial','analyst'].includes(item.kind))).toBe(false);
    expect(model.editorialProgress).toEqual(expect.objectContaining({active:0,waiting:0,status:'parked for MVP; existing packets preserved'}));
    expect(model.analystProgress).toEqual(expect.objectContaining({ideas:0,waiting:0,status:'parked for MVP; existing ideas preserved'}));
    expect(model.summary.agentWork).toBe(0);
  });

  test('keeps the executive trail-photo queue bounded while prioritising ready previews',()=>{
    const gaps=Array.from({length:20},(_,index)=>({slug:`trail-${index}`,trailId:`trail-${index}`,title:`Trail ${index}`}));
    const model=buildDashboardModel({imageAudit:{gaps,summary:{missing:20}},imageResults:{items:[{slug:'trail-19',candidates:[{status:'ready-for-asset-review'}]}]},jobs:[]});
    expect(model.imageItems).toHaveLength(15);
    expect(model.imageItems[0].slug).toBe('trail-19');
    expect(model.decisions.find(item=>item.kind==='image').title).toBe('15 trail photos need routing');
  });

  test('keeps preserved Newsletter packets out of the decision queue while parked',()=>{
    const model=buildDashboardModel({
      strategyStatus:{summary:{newsletterStatus:'parked until content readiness'}},
      newsletterPacket:{generatedAt:'2026-08-20T12:00:00Z',outputs:[{status:'ready-for-review',result:{issueTitle:'Preserved issue'}}]},
      newsletterReviews:[{packetGeneratedAt:'2026-08-20T12:00:00Z',status:'queued'}],
      jobs:[{id:'newsletter-revision',jobType:'hosted-newsletter-revision',status:'queued'}],
    });
    expect(model.decisions.some(item=>item.kind==='newsletter')).toBe(false);
    expect(model.newsletterProgress).toEqual(expect.objectContaining({ready:0,status:'parked until content readiness'}));
    expect(model.newsletterProgress.inFlight).toBe(0);
    expect(model.summary.agentWork).toBe(0);
  });
});

describe('orchestration job reads',()=>{
  const {orchestrationJobIds,orchestrationJobs}=require('./workflows/advance-trail-orchestration');

  const state={trails:[
    {candidateId:'a',jobIds:['job-1','job-2'],pendingRevisionJobId:'job-3',
      claimResolution:{water:{attempts:[{jobId:'job-4'},{jobId:'job-2'}]}}},
    {candidateId:'b',jobIds:['job-5']},
  ]};

  test('collects every job an orchestrated trail can reference, without duplicates',()=>{
    expect(orchestrationJobIds(state).sort()).toEqual(['job-1','job-2','job-3','job-4','job-5']);
  });

  test('reads only the referenced jobs instead of scanning the collection',async()=>{
    const scanned=[];const fetched=[];
    const store={
      listJobs:async statuses=>{scanned.push(statuses);return [];},
      getJobsByIds:async ids=>{fetched.push(...ids);return ids.map(id=>({id}));},
    };
    const jobs=await orchestrationJobs(store,state);
    expect(scanned).toEqual([]);
    expect(fetched.sort()).toEqual(['job-1','job-2','job-3','job-4','job-5']);
    expect(jobs).toHaveLength(5);
  });

  test('falls back to the status query for stores without id-based fetching',async()=>{
    const scanned=[];
    const store={listJobs:async statuses=>{scanned.push(statuses);return [{id:'job-1'}];}};
    await orchestrationJobs(store,state);
    expect(scanned[0]).toContain('completed');
  });
});

describe('trail coverage grid',()=>{
  const {buildCoverageGrid}=require('./dashboard-model');

  const imageAudit={pages:[
    {trailId:'seceda',title:'Seceda Ridge',area:'Val Gardena',valley:'Val Gardena',region:'dolomites',coverageState:'covered'},
    {trailId:'tre-cime',title:'Tre Cime circuit',area:'Alta Pusteria',valley:'Alta Pusteria – Tre Cime',region:'dolomites',coverageState:'missing'},
    {trailId:'lac-vert',title:'Boucle du Lac Vert',area:'Haute-Savoie',valley:'',region:'savoy',coverageState:'missing'},
  ]};
  const hazards={hazards:[
    {title:'Storm warning',severity:'severe',trailIds:['tre-cime']},
    {title:'Unconfirmed: bridge out',origin:'community',verificationState:'reported-unverified',trailIds:['lac-vert']},
  ]};
  const verifiedRegistry={verified:[{trailId:'seceda'}]};
  const orchestration={trails:[{trailId:'tre-cime',stage:'evidence-research'}]};

  test('reports one row per published trail across the three running lanes',()=>{
    const grid=buildCoverageGrid({imageAudit,hazards,verifiedRegistry,orchestration});
    expect(grid.rows).toHaveLength(3);
    const seceda=grid.rows.find(row=>row.trailId==='seceda');
    expect(seceda).toEqual(expect.objectContaining({photo:'covered',verified:'verified',hazardState:'clear'}));
    const treCime=grid.rows.find(row=>row.trailId==='tre-cime');
    expect(treCime).toEqual(expect.objectContaining({photo:'missing',verified:'in-progress',
      verificationStage:'evidence-research',hazardState:'active'}));
  });

  test('separates a confirmed hazard from an unconfirmed hiker report',()=>{
    const grid=buildCoverageGrid({imageAudit,hazards,verifiedRegistry,orchestration});
    expect(grid.rows.find(row=>row.trailId==='lac-vert').hazardState).toBe('unconfirmed');
    expect(grid.summary.unconfirmedHazards).toBe(1);
  });

  test('puts the work first: missing photos before covered, Dolomites before the rest',()=>{
    const grid=buildCoverageGrid({imageAudit,hazards,verifiedRegistry,orchestration});
    expect(grid.rows.map(row=>row.trailId)).toEqual(['tre-cime','lac-vert','seceda']);
  });

  test('summarises the two backfills against the whole catalogue',()=>{
    const grid=buildCoverageGrid({imageAudit,hazards,verifiedRegistry,orchestration});
    expect(grid.summary).toEqual(expect.objectContaining({trails:3,photoCovered:1,photoMissing:2,
      verified:1,verificationInProgress:1,trailsWithHazards:2,complete:1}));
  });

  test('survives an empty or absent artifact without throwing',()=>{
    expect(buildCoverageGrid().rows).toEqual([]);
    expect(buildCoverageGrid({imageAudit:{pages:[]}}).summary.trails).toBe(0);
  });
});
