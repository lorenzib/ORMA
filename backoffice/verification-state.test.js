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
