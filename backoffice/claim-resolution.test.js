'use strict';

const {
  STRATEGIES,strategyFor,notBeforeFor,addQueuedAttempt,mergeClaimResolutionResult,
}=require('./workflows/claim-resolution');
const {advanceTrailOrchestration}=require('./workflows/advance-trail-orchestration');

function baseResult(agentId,claims=[]){return {contractVersion:'1.0.0',candidateId:'trail-a',agentId,summary:'Checked.',claims,
  openQuestions:[],recommendation:claims.some(claim=>claim.finding==='unresolved')?'needs-resolution':'advance',publicMutationAllowed:false};}

describe('autonomous five-attempt claim resolution',()=>{
  test('schedules five materially different strategies at 0, 1, 6, 24 and 72 hours',()=>{
    const entry={attempts:[]};const at='2026-08-20T00:00:00.000Z';
    for(let index=0;index<5;index+=1){
      const strategy=strategyFor(entry);expect(strategy).toEqual(expect.objectContaining({attemptNumber:index+1,strategy:STRATEGIES[index].id}));
      expect(notBeforeFor(at,index+1)).toBe(new Date(new Date(at).getTime()+[0,1,6,24,72][index]*3600000).toISOString());
      const attempt=addQueuedAttempt(entry,{id:`job-${index+1}`},at);attempt.status='completed';
    }
    expect(()=>strategyFor(entry)).toThrow('limit reached (5)');
  });

  test('the fifth unresolved result becomes source-exhausted without losing prior supported claims',()=>{
    const previous=baseResult('logistics',[
      {id:'parking',category:'parking',proposedValue:'Unknown.',finding:'unresolved',confidence:0,rationale:'No source.',sources:[],blockers:['pin-unverified']},
      {id:'access',category:'access',proposedValue:'Road open.',finding:'supported-proposal',confidence:.9,rationale:'Official.',sources:[{label:'Road authority',url:'https://example.test/road',authority:'Authority',accessedAt:'2026-08-20'}],blockers:[]},
    ]);
    const next=baseResult('logistics',[{id:'parking',category:'parking',proposedValue:'Still unknown.',finding:'unresolved',confidence:.1,rationale:'Final search found no exact pin.',sources:[],blockers:['pin-unverified']}]);
    const merged=mergeClaimResolutionResult(previous,next,{claimIds:['parking'],resolutionAttempt:5,resolutionStrategy:STRATEGIES[4].id,resolutionStrategyLabel:STRATEGIES[4].label},'2026-08-20T00:10:00.000Z');
    expect(merged.claims).toHaveLength(2);
    expect(merged.claims.find(claim=>claim.id==='access').finding).toBe('supported-proposal');
    expect(merged.claims.find(claim=>claim.id==='parking').resolution).toEqual(expect.objectContaining({state:'source-exhausted',attemptNumber:5,maximumAttempts:5}));
    expect(merged.recommendation).toBe('block');
  });

  test('orchestration immediately queues attempt one, then delays a distinct second strategy by one hour',async()=>{
    const artifacts={
      'trail-orchestration':{contractVersion:'1.0.0',generatedAt:'2026-08-20T00:00:00.000Z',publicMutationAllowed:false,summary:{},trails:[{
        trailId:'trail-a',candidateId:'trail-a',trailName:'Trail A',state:'evidence-research',stage:'parallel-evidence-research',
        attempts:{logistics:1,regulatoryRanger:1,terrainPoi:1},resolutionAttempts:{},jobIds:['log','rules','terrain'],
        latestOutputRef:'firestore:cartographer',blockers:[],publicMutationAllowed:false,
      }]},
      'dossier-review-queue':{contractVersion:'1.0.0',items:[],publicMutationAllowed:false},
      'trail-specialist-output-log':baseResult('logistics',[{id:'parking',category:'parking',proposedValue:'Unknown.',finding:'unresolved',confidence:0,rationale:'No exact source.',sources:[],blockers:['pin-unverified']}]),
      'trail-specialist-output-rules':baseResult('regulatoryRanger'),
      'trail-specialist-output-terrain':baseResult('terrainPoi'),
    };
    const jobs=[
      {id:'log',candidateId:'trail-a',agentId:'logistics',status:'completed',createdAt:'2026-08-20T00:00:00.000Z'},
      {id:'rules',candidateId:'trail-a',agentId:'regulatoryRanger',status:'completed',createdAt:'2026-08-20T00:00:00.000Z'},
      {id:'terrain',candidateId:'trail-a',agentId:'terrainPoi',status:'completed',createdAt:'2026-08-20T00:00:00.000Z'},
    ];
    const store={
      getArtifact:async id=>artifacts[id]||null,
      setArtifact:async(id,value)=>{artifacts[id]=value;},
      listJobs:async()=>jobs,
      putJob:async job=>jobs.push(job),
    };
    const first=await advanceTrailOrchestration(store,{at:'2026-08-20T00:05:00.000Z'});
    expect(first.queued).toHaveLength(1);
    const attemptOne=jobs.find(job=>job.jobType==='trail-claim-resolution');
    expect(attemptOne).toEqual(expect.objectContaining({resolutionAttempt:1,resolutionStrategy:STRATEGIES[0].id,notBefore:'2026-08-20T00:05:00.000Z'}));
    expect(artifacts['trail-orchestration'].trails[0].state).toBe('evidence-resolution');
    const repeated=await advanceTrailOrchestration(store,{at:'2026-08-20T00:06:00.000Z'});
    expect(repeated.queued).toEqual([]);
    expect(jobs.filter(job=>job.jobType==='trail-claim-resolution')).toHaveLength(1);

    attemptOne.status='completed';attemptOne.completedAt='2026-08-20T00:10:00.000Z';
    artifacts[`trail-specialist-output-${attemptOne.id}`]=mergeClaimResolutionResult(artifacts['trail-specialist-output-log'],baseResult('logistics',[
      {id:'parking',category:'parking',proposedValue:'Unknown.',finding:'unresolved',confidence:.1,rationale:'Authority pages do not give a pin.',sources:[],blockers:['pin-unverified']},
    ]),attemptOne,attemptOne.completedAt);
    const second=await advanceTrailOrchestration(store,{at:'2026-08-20T00:10:00.000Z'});
    expect(second.queued).toHaveLength(1);
    const attemptTwo=jobs.find(job=>job.resolutionAttempt===2);
    expect(attemptTwo).toEqual(expect.objectContaining({resolutionStrategy:STRATEGIES[1].id,notBefore:'2026-08-20T01:10:00.000Z'}));
    const ledger=artifacts['trail-orchestration'].trails[0].claimResolution['logistics:parking'];
    expect(ledger.attempts).toEqual([
      expect.objectContaining({attemptNumber:1,status:'completed',finding:'unresolved'}),
      expect.objectContaining({attemptNumber:2,status:'queued'}),
    ]);
  });
});
