'use strict';

const {tally,buildVerificationReport}=require('./cli/report-verification-state');

function store(artifacts={},jobs=[]){
  const map=new Map(Object.entries(artifacts));const reads=[];
  return {reads,getArtifact:async id=>map.get(id)??null,
    listJobs:async statuses=>{reads.push(statuses);return jobs;}};
}

describe('verification state report',()=>{
  test('separates gates the machine already cleared from ones needing judgement',async()=>{
    const target=store({
      'orma-verified-registry-live':{verified:[{trailId:'a'},{trailId:'b'}]},
      'trail-orchestration':{trails:[{trailId:'c',state:'dossier-human-gate',stage:'evidence'},
        {trailId:'d',state:'geometry-human-gate',stage:'geometry'},{trailId:'e',state:'red-team',stage:'counter'}]},
      'dossier-review-queue':{items:[
        {trailId:'c',state:'awaiting-human',gateType:'dossier-approval',approvalAllowed:true},
        {trailId:'d',state:'awaiting-human',gateType:'geometry-approval',approvalAllowed:false,
          blockingReasons:['terrainPoi/water: conflicted','logistics: open question — parking']},
        {trailId:'f',state:'resolved',gateType:'dossier-approval',approvalAllowed:true},
      ]},
    });
    const report=await buildVerificationReport({store:target});
    expect(report.verified).toBe(2);
    expect(report.inPipeline).toBe(3);
    expect(report.awaitingHuman.total).toBe(2);
    expect(report.awaitingHuman.readyToApprove).toBe(1);
    expect(report.awaitingHuman.needsJudgement).toBe(1);
    expect(report.awaitingHuman.readyByGate).toEqual([['dossier-approval',1]]);
    expect(report.sampleReadyToApprove).toEqual([{trailId:'c',gate:'dossier-approval'}]);
    expect(report.topBlockingReasons).toEqual([['terrainPoi/water',1],['logistics',1]]);
  });

  test('counts pipeline states and downstream work',async()=>{
    const target=store({
      'trail-orchestration':{trails:[{trailId:'a',state:'red-team'},{trailId:'b',state:'red-team'}]},
      'verified-trail-editorial-execution':{outputs:[{status:'ready-for-review'},{status:'draft'}]},
      'publication-staging':{items:[{state:'ready-for-publication-preview'},{state:'waiting'}]},
    });
    const report=await buildVerificationReport({store:target});
    expect(report.byState).toEqual([['red-team',2]]);
    expect(report.downstream).toEqual(expect.objectContaining({editorialOutputs:2,editorialReadyForReview:1,
      publicationStaging:2,publicationReady:1}));
    expect(report.downstream.editorialByStatus).toEqual([['ready-for-review',1],['draft',1]]);
  });

  test('says why each staged trail stopped short of the website',async()=>{
    // "3 staged, 0 ready" was the last number before the website and it named
    // no cause, so a moderator decision and a mapping defect were
    // indistinguishable without opening the desk.
    const target=store({
      'trail-orchestration':{trails:[]},
      'publication-staging':{items:[
        {candidateId:'osm-1',targetTrailId:'t1',operation:'update-existing',state:'waiting-content-approvals',
         missingApprovals:['editorial-approval'],publicationMappingBlockers:[],
         sourceApprovals:{copy:null,visual:{action:'approve'}}},
        {candidateId:'osm-2',state:'waiting-publication-mapping',missingApprovals:[],
         publicationMappingBlockers:['website-target-mapping','route-number-guidance']},
      ]},
    });
    const [waitingOnHer,waitingOnMapping]=(await buildVerificationReport({store:target})).downstream.publicationStalls;
    expect(waitingOnHer).toEqual(expect.objectContaining({candidateId:'osm-1',
      missingApprovals:['editorial-approval'],copyDecision:null,visualDecision:'approve'}));
    expect(waitingOnMapping).toEqual(expect.objectContaining({candidateId:'osm-2',
      publicationMappingBlockers:['website-target-mapping','route-number-guidance']}));
  });

  test('reports empty state without throwing and writes nothing',async()=>{
    const target=store();
    const report=await buildVerificationReport({store:target});
    expect(report).toEqual(expect.objectContaining({verified:0,inPipeline:0}));
    expect(report.awaitingHuman.total).toBe(0);
    expect(target.setArtifact).toBeUndefined();
  });

  test('tally groups by the chosen key, most frequent first',()=>{
    expect(tally([{a:'x'},{a:'y'},{a:'x'}],item=>item.a)).toEqual([['x',2],['y',1]]);
  });
});

// #647 added publicationStalls, editorialByStatus and editorialOutputJobs to
// the report object and printed none of them. Reading them meant pulling the
// JSON dump out of a workflow log, which is how one blocked trail went seven
// weeks without anyone naming it. A diagnostic that only a parser can read is
// not yet a diagnostic.
describe('the report says why a staged trail stopped short',()=>{
  const {main}=require('./cli/report-verification-state.js');
  const lines=async artifacts=>{
    const target={getArtifact:async key=>artifacts[key]||null,listJobs:async()=>[],
      listDossierReviews:async()=>[],getDecisionHistory:async()=>[],listPublicationReviews:async()=>[]};
    const real=console.log;const out=[];
    console.log=(...args)=>out.push(args.join(' '));
    try{await main({store:target});}finally{console.log=real;}
    return out.join('\n');
  };
  const staging=items=>({'trail-orchestration':{trails:[]},'publication-staging':{items}});

  test('a decision you can make is told apart from a defect you cannot',async()=>{
    const out=await lines(staging([
      {candidateId:'osm-1',targetTrailId:'lago-nero',operation:'update-existing',
       state:'waiting-content-approvals',missingApprovals:['editorial-approval'],publicationMappingBlockers:[]},
      {candidateId:'osm-2',operation:'create-new',state:'waiting-publication-mapping',
       missingApprovals:[],publicationMappingBlockers:['website-target-mapping']},
    ]));
    expect(out).toMatch(/1 waiting on a decision you can make now/);
    expect(out).toMatch(/1 held by a mapping defect, which no decision clears/);
    expect(out).toMatch(/lago-nero .* waiting-content-approvals/);
    expect(out).toMatch(/awaiting editorial-approval/);
    expect(out).toMatch(/cannot map: website-target-mapping/);
  });

  // A clean queue must not read as a problem.
  test('a trail that is ready to go is counted, not listed as stalled',async()=>{
    const out=await lines(staging([
      {candidateId:'osm-3',targetTrailId:'t3',operation:'update-existing',
       state:'ready-for-publication-preview',missingApprovals:[],publicationMappingBlockers:[]},
    ]));
    expect(out).toMatch(/1 trail\(s\) staged for the website: 1 ready to go/);
    expect(out).not.toMatch(/t3 ·/);
    expect(out).not.toMatch(/stopped short/);
  });

  // What the first live run got wrong: the filter named the states that are
  // not stalls, and `published` was not among them, so three trails already on
  // the website were listed as having stopped short of it.
  test('a published trail is not stopped short of the website',async()=>{
    const out=await lines(staging([
      {candidateId:'tre-cime',targetTrailId:'tre-cime',operation:'update-existing',
       state:'published',missingApprovals:[],publicationMappingBlockers:[]},
    ]));
    expect(out).toMatch(/1 trail\(s\) staged for the website: 1 already published/);
    expect(out).not.toMatch(/stopped short/);
    expect(out).not.toMatch(/tre-cime ·/);
  });

  test('and a mixed queue counts each kind without listing the finished ones',async()=>{
    const out=await lines(staging([
      {candidateId:'done',operation:'update-existing',state:'published',
       missingApprovals:[],publicationMappingBlockers:[]},
      {candidateId:'stuck',operation:'create-new',state:'waiting-publication-mapping',
       missingApprovals:[],publicationMappingBlockers:['website-target-mapping']},
    ]));
    expect(out).toMatch(/2 trail\(s\) staged for the website: 1 already published · 1 stopped short/);
    expect(out).toMatch(/stuck ·/);
    expect(out).not.toMatch(/done ·/);
  });

  test('nothing staged says nothing at all',async()=>{
    expect(await lines(staging([]))).not.toMatch(/staged for the website/);
  });

  // "ready-for-review" keeps counting a draft whose decision was already made.
  test('editorial outputs are broken down by status',async()=>{
    const out=await lines({...staging([]),
      'verified-trail-editorial-execution':{outputs:[
        {jobId:'j1',status:'ready-for-review'},{jobId:'j2',status:'ready-for-review'},{jobId:'j3',status:'draft'}]}});
    expect(out).toMatch(/Editorial outputs by status: 2 ready-for-review · 1 draft/);
  });
});
