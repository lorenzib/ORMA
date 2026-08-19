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
    expect(model.activity).toEqual(expect.arrayContaining([expect.objectContaining({status:'queued',message:expect.stringContaining('within five minutes')})]));
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
    expect(model.activity[0]).toEqual(expect.objectContaining({status:'queued',message:expect.stringContaining('within five minutes')}));
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
});
