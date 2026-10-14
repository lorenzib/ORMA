'use strict';

const {
  STRATEGIES,strategyFor,notBeforeFor,addQueuedAttempt,mergeClaimResolutionResult,
}=require('./workflows/claim-resolution');
const {advanceTrailOrchestration}=require('./workflows/advance-trail-orchestration');
const {MAX_AUTOMATED_ATTEMPTS,MAX_WAIVABLE_ATTEMPTS,RETRY_DELAYS_HOURS}=require('./contracts/resolution-policy-v1');
const {ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier');

function baseResult(agentId,claims=[]){return {contractVersion:'1.0.0',candidateId:'trail-a',agentId,summary:'Checked.',claims,
  openQuestions:[],recommendation:claims.some(claim=>claim.finding==='unresolved')?'needs-resolution':'advance',publicMutationAllowed:false};}

describe('autonomous claim resolution',()=>{
  // Two ladders since 2026-10-13: the directions a walk cannot be verified
  // without keep all five looks, and optional detail stops at three. Both
  // lengths are read from the contract rather than typed here, so changing one
  // of them fails the assertion that is actually wrong rather than every test
  // in the file.
  const walkLadder=(entry,ceiling)=>{
    const at='2026-08-20T00:00:00.000Z';
    for(let index=0;index<ceiling;index+=1){
      const strategy=strategyFor(entry);
      expect(strategy).toEqual(expect.objectContaining({attemptNumber:index+1,strategy:STRATEGIES[index].id}));
      expect(notBeforeFor(at,index+1)).toBe(new Date(new Date(at).getTime()+RETRY_DELAYS_HOURS[index]*3600000).toISOString());
      const attempt=addQueuedAttempt(entry,{id:`job-${index+1}`},at);attempt.status='completed';
    }
    expect(()=>strategyFor(entry)).toThrow(`limit reached (${ceiling})`);
  };

  test('a direction keeps the full ladder of materially different strategies',()=>{
    walkLadder({claimId:ROUTE_GUIDANCE_CLAIM_IDS[0],attempts:[]},MAX_AUTOMATED_ATTEMPTS);
  });

  test('optional detail stops at three rather than researching to five',()=>{
    walkLadder({claimId:'parking',attempts:[]},MAX_WAIVABLE_ATTEMPTS);
    expect(MAX_WAIVABLE_ATTEMPTS).toBeLessThan(MAX_AUTOMATED_ATTEMPTS);
  });

  test('a claim with no id named is treated as optional, never granted the long ladder',()=>{
    walkLadder({attempts:[]},MAX_WAIVABLE_ATTEMPTS);
  });

  test('the last unresolved result becomes source-exhausted without losing prior supported claims',()=>{
    const previous=baseResult('logistics',[
      {id:'parking',category:'parking',proposedValue:'Unknown.',finding:'unresolved',confidence:0,rationale:'No source.',sources:[],blockers:['pin-unverified']},
      {id:'access',category:'access',proposedValue:'Road open.',finding:'supported-proposal',confidence:.9,rationale:'Official.',sources:[{label:'Road authority',url:'https://example.test/road',authority:'Authority',accessedAt:'2026-08-20'}],blockers:[]},
    ]);
    const next=baseResult('logistics',[{id:'parking',category:'parking',proposedValue:'Still unknown.',finding:'unresolved',confidence:.1,rationale:'Final search found no exact pin.',sources:[],blockers:['pin-unverified']}]);
    // `parking` is optional detail, so its ladder ends at MAX_WAIVABLE_ATTEMPTS.
    const last=MAX_WAIVABLE_ATTEMPTS;
    const merged=mergeClaimResolutionResult(previous,next,{claimIds:['parking'],resolutionAttempt:last,resolutionStrategy:STRATEGIES[last-1].id,resolutionStrategyLabel:STRATEGIES[last-1].label},'2026-08-20T00:10:00.000Z');
    expect(merged.claims).toHaveLength(2);
    expect(merged.claims.find(claim=>claim.id==='access').finding).toBe('supported-proposal');
    expect(merged.claims.find(claim=>claim.id==='parking').resolution).toEqual(expect.objectContaining({state:'source-exhausted',attemptNumber:last,maximumAttempts:MAX_WAIVABLE_ATTEMPTS}));
    // The sentence the gate policy recognises carries no hardcoded count.
    expect(merged.claims.find(claim=>claim.id==='parking').blockers)
      .toContain(`${MAX_WAIVABLE_ATTEMPTS} materially different automated research strategies were exhausted.`);
    expect(merged.recommendation).toBe('block');
  });

  test('orchestration immediately queues attempt one, then a distinct second strategy as soon as the first returns',async()=>{
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
    expect(attemptTwo).toEqual(expect.objectContaining({resolutionStrategy:STRATEGIES[1].id,notBefore:'2026-08-20T00:10:00.000Z'}));
    const ledger=artifacts['trail-orchestration'].trails[0].claimResolution['logistics:parking'];
    expect(ledger.attempts).toEqual([
      expect.objectContaining({attemptNumber:1,status:'completed',finding:'unresolved'}),
      expect.objectContaining({attemptNumber:2,status:'queued'}),
    ]);
  });
});

// 9 October: terrainPoi answered a claim it called `livestock-and-guardian-dogs`
// with "varies". claim.id is a free string in the schema, so an agent can name a
// claim ORMA does not have, and a near-miss of a real variable claim is the
// likely way it does. Throwing retried the run at the same resolutionAttempt,
// so the agent invented the same id again and the job died on its failure
// budget -- the mistake the attempt check below it already records as wrong.
describe('"varies" on a claim that cannot vary does not kill the job',()=>{
  const {validateVariesClaims,VARIABLE_CLAIM_IDS,MIN_VARIES_RESOLUTION_ATTEMPT}=
    require('./workflows/run-trail-specialist');
  const claim=(overrides={})=>({id:'livestock-and-guardian-dogs',category:'terrain',
    proposedValue:'Depends on the season.',finding:'varies',confidence:0.4,
    rationale:'Pastures are used in summer.',sources:[],...overrides});
  const resolve=(claims,attempt)=>{
    const result={claims};
    validateVariesClaims(result,{resolutionAttempt:attempt});
    return result.claims;
  };

  test('an invented claim id is recorded, not thrown',()=>{
    const [kept]=resolve([claim()],MIN_VARIES_RESOLUTION_ATTEMPT);
    expect(kept.finding).toBe('unresolved');
    expect(kept.blockers).toContain('livestock-and-guardian-dogs-cannot-vary');
    expect(kept.reopenedFromVaries).toBe(true);
  });

  test('and is never corrected to the real claim it resembles',()=>{
    const [kept]=resolve([claim()],MIN_VARIES_RESOLUTION_ATTEMPT);
    expect(kept.id).toBe('livestock-and-guardian-dogs');
    expect(VARIABLE_CLAIM_IDS).toContain('livestock');
    expect(VARIABLE_CLAIM_IDS).not.toContain('livestock-and-guardian-dogs');
  });

  test('a real claim that genuinely cannot vary is recorded the same way',()=>{
    const [kept]=resolve([claim({id:'water'})],MIN_VARIES_RESOLUTION_ATTEMPT);
    expect(kept.finding).toBe('unresolved');
    expect(kept.blockers).toContain('water-cannot-vary');
  });

  test('it says in the rationale why "varies" was not kept',()=>{
    const [kept]=resolve([claim()],MIN_VARIES_RESOLUTION_ATTEMPT);
    expect(kept.rationale).toContain('not available for livestock-and-guardian-dogs');
    expect(kept.rationale).toContain('Pastures are used in summer.');
  });

  test('a claim that may vary, answered late enough, is still accepted',()=>{
    const [kept]=resolve([claim({id:'livestock',variesWith:'the grazing season',
      sources:[{url:'https://comune.example/alpeggio',title:'t',publisher:'p'}]})],
      MIN_VARIES_RESOLUTION_ATTEMPT);
    expect(kept.finding).toBe('varies');
  });

  test('and answered too early is still reopened, not thrown',()=>{
    const [kept]=resolve([claim({id:'livestock'})],0);
    expect(kept.finding).toBe('unresolved');
    expect(kept.reopenedFromVaries).toBe(true);
  });

  test('nothing here is fatal any more',()=>{
    expect(()=>resolve([claim(),claim({id:'water'}),claim({id:'livestock'})],1)).not.toThrow();
  });
});

// Observed on alpe-siusi: the cartographer cited ORMA's own internal artifact
// pointer as a source. The agent is shown prior specialist output, which
// carries those pointers in `outputRef`, so it had read one and taken it for a
// page it had visited. Throwing blocked the job permanently -- the retry reread
// the same context and cited the same pointer -- and that job was one of the
// four agent failures holding the dossier stage.
describe('a source nobody can open is dropped, not fatal',()=>{
  const {dropUnretrievableSources,validateSpecialistResult}=
    require('./workflows/run-trail-specialist');
  const POINTER='firestore:trail-specialist-output-trail-verification-alpe-siusi-cartographer-1';
  const web=url=>({url,title:'Official notice',publisher:'comune.example'});
  const claim=(overrides={})=>({id:'water',category:'terrain',proposedValue:'A fountain at the col.',
    finding:'supported-proposal',confidence:0.8,rationale:'The comune lists it.',
    sources:[web('https://comune.example/acqua')],...overrides});

  test('the internal pointer is removed and recorded',()=>{
    const result={claims:[claim({sources:[web('https://comune.example/acqua'),web(POINTER)]})]};
    const dropped=dropUnretrievableSources(result);
    expect(dropped).toEqual([{claimId:'water',url:POINTER}]);
    expect(result.claims[0].sources.map(source=>source.url))
      .toEqual(['https://comune.example/acqua']);
  });

  test('a claim keeping a real source stays supported',()=>{
    const result={claims:[claim({sources:[web('https://comune.example/acqua'),web(POINTER)]})]};
    expect(()=>validateSpecialistResult(result,'cartographer')).not.toThrow();
    expect(result.claims[0].finding).toBe('supported-proposal');
    expect(result.claims[0].blockers).toContain('water-source-not-retrievable');
  });

  // The whole point: it must not survive as "supported" on a citation nobody
  // can check. Unresolved is resolvable, so the loop asks again.
  test('a claim left with no real source stops calling itself supported',()=>{
    const result={claims:[claim({sources:[web(POINTER)]})]};
    expect(()=>validateSpecialistResult(result,'cartographer')).not.toThrow();
    expect(result.claims[0].finding).toBe('unresolved');
    expect(result.claims[0].blockers).toContain('water-source-not-retrievable');
    expect(result.claims[0].rationale).toContain('not a retrievable page');
  });

  test('http, ftp and a bare domain are all unretrievable',()=>{
    for(const url of ['http://comune.example/x','ftp://comune.example/x','comune.example/x','']){
      const result={claims:[claim({sources:[web(url)]})]};
      validateSpecialistResult(result,'cartographer');
      expect(result.claims[0].sources).toEqual([]);
    }
  });

  test('a result with only real sources is untouched',()=>{
    const result={claims:[claim()]};
    expect(dropUnretrievableSources(result)).toEqual([]);
    expect(result.claims[0]).toEqual(claim());
  });

  test('a supported proposal that never had a source is still fatal',()=>{
    expect(()=>validateSpecialistResult({claims:[claim({sources:[]})]},'cartographer'))
      .toThrow(/requires a source/);
  });
});
