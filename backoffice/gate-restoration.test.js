'use strict';

const {restoreMissingGateReviews,advanceTrailOrchestration}=require('./workflows/advance-trail-orchestration');

const AT='2026-09-05T20:00:00.000Z';

function trail(overrides={}){
  return {candidateId:'c1',trailId:'seceda',trailName:'Seceda Ridge',state:'dossier-human-gate',
    stage:'complete-evidence-dossier',currentJobId:'job-9',jobIds:['job-9'],attempts:{},blockers:[],
    gate:{id:'dossier-approval',status:'awaiting-human',openedAt:AT},...overrides};
}

function store(artifacts={}){
  const map=new Map(Object.entries(artifacts));const writes=[];
  return {map,writes,getArtifact:async id=>map.get(id)??null,
    setArtifact:async(id,value)=>{map.set(id,value);writes.push(id);},
    listJobs:async()=>[],getJobsByIds:async()=>[],putJob:async()=>{}};
}

describe('a trail parked at a gate is always visible',()=>{
  test('rebuilds a review item that went missing',async()=>{
    const source=[{url:'https://example.org/route',authority:'Comune di Ortisei'}];
    const supported=id=>({id,finding:'supported-proposal',proposedValue:'stated',sources:source});
    const target=store({
      'trail-specialist-output-job-9':{agentId:'redTeam',claims:[],openQuestions:[],recommendation:'advance'},
      'trail-specialist-output-job-8':{agentId:'logistics',recommendation:'advance',openQuestions:[],
        claims:['recommended-start','route-number-status','route-number-sequence','route-number-switches'].map(supported)},
    });
    const queue={items:[]};
    const jobs=[{id:'job-9',candidateId:'c1',agentId:'redTeam',status:'completed',completedAt:AT},
      {id:'job-8',candidateId:'c1',agentId:'logistics',status:'completed',completedAt:AT}];
    const restored=await restoreMissingGateReviews(target,{trails:[trail()]},queue,AT,jobs);
    expect(restored).toEqual(['seceda']);
    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toEqual(expect.objectContaining({trailId:'seceda',gateType:'dossier-approval',
      state:'awaiting-human',approvalAllowed:true,restoredAt:AT}));
    expect(queue.items[0].specialistOutputs[0].jobId).toBe('job-9');
  });

  test('does not duplicate an item that is already live',async()=>{
    const queue={items:[{trailId:'seceda',state:'awaiting-human',gateType:'dossier-approval'}]};
    expect(await restoreMissingGateReviews(store(),{trails:[trail()]},queue,AT)).toEqual([]);
    expect(queue.items).toHaveLength(1);
  });

  test('a trail that is not at a gate is left alone',async()=>{
    const queue={items:[]};
    expect(await restoreMissingGateReviews(store(),{trails:[trail({state:'red-team'})]},queue,AT)).toEqual([]);
    expect(queue.items).toEqual([]);
  });

  test('never restores as approvable when the evidence cannot be re-read',async()=>{
    const queue={items:[]};
    await restoreMissingGateReviews(store(),{trails:[trail()]},queue,AT);
    expect(queue.items[0].approvalAllowed).toBe(false);
  });

  test('a dossier with a conflicted claim is restored needing judgement',async()=>{
    const target=store({'trail-specialist-output-job-9':{agentId:'redTeam',recommendation:'advance',openQuestions:[],
      claims:[{id:'water',finding:'conflicted'}]}});
    const queue={items:[]};
    await restoreMissingGateReviews(target,{trails:[trail()]},queue,AT);
    expect(queue.items[0].approvalAllowed).toBe(false);
    expect(queue.items[0].blockingReasons.join(' ')).toContain('conflicted');
  });

  test('an agent failure is never restored as approvable',async()=>{
    const queue={items:[]};
    await restoreMissingGateReviews(store(),{trails:[trail({gate:{id:'agent-failure'},
      blockers:['agent-job-blocked:cartographer']})]},queue,AT);
    expect(queue.items[0]).toEqual(expect.objectContaining({gateType:'agent-failure',approvalAllowed:false,
      allowedActions:['request-revision','reject']}));
  });

  test('a geometry gate needs a ready review state, not just no blockers',async()=>{
    const queue={items:[]};
    const target=store({'trail-specialist-output-job-9':{agentId:'cartographer',reviewState:'draft',blockers:[]}});
    await restoreMissingGateReviews(target,{trails:[trail({state:'geometry-human-gate',
      gate:{id:'geometry-approval'}})]},queue,AT);
    expect(queue.items[0].approvalAllowed).toBe(false);
  });

  test('a repair is persisted even when no trail advanced',async()=>{
    const target=store({
      'trail-orchestration':{trails:[trail()],summary:{}},
      'dossier-review-queue':{contractVersion:'1.0.0',items:[]},
      'trail-specialist-output-job-9':{agentId:'redTeam',recommendation:'advance',openQuestions:[],claims:[]},
    });
    const result=await advanceTrailOrchestration(target,{at:AT});
    expect(result.advanced).toEqual([]);
    expect(result.restored).toEqual(['seceda']);
    expect(target.writes).toContain('dossier-review-queue');
    expect(target.map.get('dossier-review-queue').items).toHaveLength(1);
    expect(target.map.get('dossier-review-queue').summary.awaitingHuman).toBe(1);
  });
});

describe('the review queue cannot outgrow its Firestore document',()=>{
  const {restoreMissingGateReviews,REVIEW_QUEUE_SAFE_BYTES}=require('./workflows/advance-trail-orchestration');

  test('restores only as many trails as fit, and never overflows',async()=>{
    // A realistic dossier is large; fifteen of them do not fit in one document.
    const heavy={agentId:'redTeam',recommendation:'advance',openQuestions:[],
      claims:Array.from({length:40},(_,i)=>({id:`claim-${i}`,finding:'supported',
        evidence:'x'.repeat(3000),sources:[{url:'https://example.org/a',authority:'A'}]}))};
    const artifacts={};const trails=[];const jobs=[];
    for(let i=0;i<15;i+=1){
      artifacts[`trail-specialist-output-job-${i}`]=heavy;
      jobs.push({id:`job-${i}`,candidateId:`c${i}`,agentId:'redTeam',status:'completed',completedAt:AT});
      trails.push({candidateId:`c${i}`,trailId:`trail-${i}`,trailName:`Trail ${i}`,state:'dossier-human-gate',
        currentJobId:`job-${i}`,jobIds:[`job-${i}`],attempts:{},blockers:[],gate:{id:'dossier-approval',openedAt:AT}});
    }
    const queue={contractVersion:'1.0.0',items:[]};
    const restored=await restoreMissingGateReviews(store(artifacts),{trails},queue,AT,jobs);
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.length).toBeLessThan(15);
    expect(Buffer.byteLength(JSON.stringify(queue),'utf8')).toBeLessThanOrEqual(REVIEW_QUEUE_SAFE_BYTES);
  });

  test('a later pass restores the ones that did not fit',async()=>{
    const small={agentId:'redTeam',recommendation:'advance',openQuestions:[],claims:[]};
    const artifacts={'trail-specialist-output-job-a':small,'trail-specialist-output-job-b':small};
    const trails=[
      {candidateId:'ca',trailId:'a',state:'dossier-human-gate',currentJobId:'job-a',jobIds:['job-a'],attempts:{},blockers:[],gate:{id:'dossier-approval'}},
      {candidateId:'cb',trailId:'b',state:'dossier-human-gate',currentJobId:'job-b',jobIds:['job-b'],attempts:{},blockers:[],gate:{id:'dossier-approval'}},
    ];
    const jobs=[{id:'job-a',candidateId:'ca',agentId:'redTeam',status:'completed'},
      {id:'job-b',candidateId:'cb',agentId:'redTeam',status:'completed'}];
    const queue={items:[]};
    await restoreMissingGateReviews(store(artifacts),{trails:[trails[0]]},queue,AT,jobs);
    expect(queue.items.map(item=>item.trailId)).toEqual(['a']);
    await restoreMissingGateReviews(store(artifacts),{trails},queue,AT,jobs);
    expect(queue.items.map(item=>item.trailId)).toEqual(['a','b']);
  });
});
