'use strict';

const fs=require('fs');
const path=require('path');
const {reviewVerdicts,adjudicableBlockers,adjudicateGateBlockers,mergeAdjudications,
  adjudicationMatches,independentHosts,prompt}=require('./workflows/adjudicate-gate-blockers');
const {adjudicateStandingGates}=require('./workflows/run-live-backoffice-worker');
const {routeGuidanceBlockingReasons,MIN_ACCEPTANCE_REASON}=require('./workflows/compile-verified-dossier');

const at='2026-10-06T22:00:00.000Z';

// Both the unwaivable shape and the minimum reason length come from the
// contract that enforces them, never retyped here.
const [ROUTE_GUIDANCE]=routeGuidanceBlockingReasons([]);
const EXHAUSTED='terrainPoi/livestock: five automated resolution strategies exhausted';
const CONFLICTED='terrainPoi/shade: conflicted';

const source=(host,quote='Cani ammessi al guinzaglio.')=>
  ({url:`https://${host}/sentieri/notice`,publisher:host,quote});

function item(overrides={}){
  return {reviewId:'review-a',candidateId:'cand-a',trailId:'trail-a',trailName:'Trail A',
    gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:false,
    blockingReasons:overrides.blockingReasons||[EXHAUSTED,CONFLICTED,ROUTE_GUIDANCE],...overrides};
}

describe('what the adjudicator is allowed to recommend',()=>{
  const dropReasons=result=>result.dropped.map(entry=>entry.rule);

  test('only blockers a reason could clear are ever asked about',()=>{
    expect(adjudicableBlockers(item())).toEqual([EXHAUSTED,CONFLICTED]);
  });

  test('a verdict about a blocker this gate does not have is discarded',()=>{
    const result=reviewVerdicts([{blocker:'terrainPoi/water: invented',recommendation:'accept',
      reason:'Water is fine all year round.',confidence:'single-source',sources:[source('comune.example')]}],
      [EXHAUSTED]);
    expect(result.verdicts).toEqual([]);
    expect(dropReasons(result)).toEqual(['blocker-is-not-on-this-gate']);
  });

  // compile-verified-dossier is explicit that route guidance is supplied and
  // never waived. A recommendation to accept one would pre-fill a box the desk
  // does not even render, for a decision the contract refuses.
  test('it cannot recommend accepting route guidance',()=>{
    const result=reviewVerdicts([{blocker:ROUTE_GUIDANCE,recommendation:'accept',
      reason:'The start is obvious from the car park.',confidence:'single-source',sources:[source('comune.example')]}],
      [ROUTE_GUIDANCE]);
    expect(result.verdicts).toEqual([]);
    expect(dropReasons(result)).toEqual(['blocker-cannot-be-accepted']);
  });

  test('a reason too short for the contract to keep is discarded',()=>{
    const short='x'.repeat(MIN_ACCEPTANCE_REASON-1);
    const result=reviewVerdicts([{blocker:EXHAUSTED,recommendation:'accept',reason:short,
      confidence:'single-source',sources:[source('comune.example')]}],[EXHAUSTED]);
    expect(dropReasons(result)).toEqual(['reason-too-short-to-be-accepted']);
  });

  // The sentence beside a tick-box is kept with the verification permanently.
  test('an accept with no source anybody could open is discarded',()=>{
    const result=reviewVerdicts([{blocker:EXHAUSTED,recommendation:'accept',
      reason:'Livestock is not present on this section in any season.',confidence:'unsourced',sources:[]}],
      [EXHAUSTED]);
    expect(dropReasons(result)).toEqual(['accept-without-a-retrievable-source']);
  });

  test('corroborated means two publishers, not one page cited twice',()=>{
    const once=reviewVerdicts([{blocker:EXHAUSTED,recommendation:'accept',
      reason:'The pasture is fenced away from the path.',confidence:'corroborated',
      sources:[source('comune.example'),source('comune.example','Recinzione lungo il sentiero.')]}],[EXHAUSTED]);
    expect(once.verdicts[0].confidence).toBe('single-source');

    const twice=reviewVerdicts([{blocker:EXHAUSTED,recommendation:'accept',
      reason:'The pasture is fenced away from the path.',confidence:'corroborated',
      sources:[source('comune.example'),source('parco.example','Il pascolo e recintato.')]}],[EXHAUSTED]);
    expect(twice.verdicts[0].confidence).toBe('corroborated');
    expect(independentHosts(twice.verdicts[0].sources)).toBe(2);
  });

  test('a second verdict on the same blocker is ignored, not merged',()=>{
    const result=reviewVerdicts([
      {blocker:EXHAUSTED,recommendation:'cannot-accept',reason:'Nothing published either way.',confidence:'unsourced',sources:[]},
      {blocker:EXHAUSTED,recommendation:'accept',reason:'Actually it is fine, honestly.',confidence:'single-source',sources:[source('comune.example')]},
    ],[EXHAUSTED]);
    expect(result.verdicts).toHaveLength(1);
    expect(result.verdicts[0].recommendation).toBe('cannot-accept');
    expect(dropReasons(result)).toEqual(['duplicate-verdict']);
  });

  // "We looked and found nothing" needs no source and must survive: it is the
  // most useful thing to know before deciding.
  test('a refusal to recommend is kept without a source',()=>{
    const result=reviewVerdicts([{blocker:CONFLICTED,recommendation:'cannot-accept',
      reason:'Two sources disagree on canopy and neither is official.',confidence:'unsourced',sources:[]}],[CONFLICTED]);
    expect(result.verdicts).toEqual([expect.objectContaining({recommendation:'cannot-accept',confidence:'unsourced'})]);
    expect(result.dropped).toEqual([]);
  });
});

describe('the adjudication record',()=>{
  const verdict={blocker:EXHAUSTED,recommendation:'accept',
    reason:'The pasture is fenced away from the path for its whole length.',
    confidence:'corroborated',sources:[source('comune.example'),source('parco.example','Il pascolo e recintato.')]};

  test('it searches the web and judges only the blockers it was given',async()=>{
    let seen=null;
    const record=await adjudicateGateBlockers(item(),{at,runAgent:async input=>{
      seen=input;return {model:'test-model',responseId:'resp-1',data:{verdicts:[verdict],summary:'One cleared.'}};
    }});
    expect(seen.webSearch).toBe(true);
    const asked=seen.messages[1].content;
    expect(asked).toContain(EXHAUSTED);
    expect(asked).toContain(CONFLICTED);
    expect(asked).not.toContain(ROUTE_GUIDANCE);
    expect(record.verdicts).toHaveLength(1);
    expect(record.blockers).toEqual([EXHAUSTED,CONFLICTED]);
  });

  // It recommends. Nothing in the record is a decision, and nothing downstream
  // could read one out of it.
  test('it carries no decision of any kind',async()=>{
    const record=await adjudicateGateBlockers(item(),{at,
      runAgent:async()=>({model:'m',responseId:'r',data:{verdicts:[verdict],summary:''}})});
    expect(record.publicMutationAllowed).toBe(false);
    expect(record.action).toBeUndefined();
    expect(record.acceptedBlockers).toBeUndefined();
    expect(record.approved).toBeUndefined();
  });

  test('a gate with nothing a reason could clear is never sent',async()=>{
    await expect(adjudicateGateBlockers(item({blockingReasons:[ROUTE_GUIDANCE]}),
      {at,runAgent:async()=>{throw new Error('should not be called');}}))
      .rejects.toThrow('no blocker a reason could clear');
  });

  test('a stored recommendation stops applying when the blockers change',async()=>{
    const record=await adjudicateGateBlockers(item(),{at,
      runAgent:async()=>({model:'m',responseId:'r',data:{verdicts:[verdict],summary:''}})});
    expect(adjudicationMatches(record,item())).toBe(true);
    expect(adjudicationMatches(record,item({blockingReasons:[EXHAUSTED,ROUTE_GUIDANCE]}))).toBe(false);
  });

  test('the artifact keeps the newest per review and stays bounded',()=>{
    const first={reviewId:'review-a',adjudicatedAt:at,verdicts:[]};
    const second={reviewId:'review-a',adjudicatedAt:'2026-10-06T23:00:00.000Z',verdicts:[verdict]};
    const merged=mergeAdjudications(mergeAdjudications(null,first),second);
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0].adjudicatedAt).toBe(second.adjudicatedAt);
    const many=[...Array(5)].reduce((artifact,_,index)=>
      mergeAdjudications(artifact,{reviewId:`review-${index}`,adjudicatedAt:at,verdicts:[]},{limit:3}),null);
    expect(many.items).toHaveLength(3);
  });
});

describe('the worker lane',()=>{
  function store(queueItems,stored=null){
    const artifacts={'dossier-review-queue':{items:queueItems},'gate-adjudications':stored};
    const calls=[];
    return {artifacts,calls,
      getArtifact:async id=>artifacts[id]||null,
      setArtifact:async(id,value)=>{artifacts[id]=value;calls.push(id);}};
  }
  const answer=blocker=>async()=>({model:'m',responseId:'r',data:{verdicts:[{blocker,
    recommendation:'cannot-accept',reason:'Nothing published either way.',confidence:'unsourced',sources:[]}],summary:''}});

  test('it adjudicates a standing gate and writes the artifact',async()=>{
    const subject=store([item()]);
    const outcomes=await adjudicateStandingGates(subject,{at,runAgent:answer(EXHAUSTED)});
    expect(outcomes).toEqual([expect.objectContaining({reviewId:'review-a',status:'adjudicated',verdicts:1})]);
    expect(subject.artifacts['gate-adjudications'].items[0].reviewId).toBe('review-a');
  });

  test('a recommendation already standing against these blockers is not re-asked',async()=>{
    const subject=store([item()]);
    await adjudicateStandingGates(subject,{at,runAgent:answer(EXHAUSTED)});
    const again=await adjudicateStandingGates(subject,{at,runAgent:async()=>{throw new Error('should not be called');}});
    expect(again).toEqual([]);
  });

  test('a gate holding only route guidance is left alone',async()=>{
    const subject=store([item({blockingReasons:[ROUTE_GUIDANCE]})]);
    expect(await adjudicateStandingGates(subject,{at,runAgent:async()=>{throw new Error('should not be called');}})).toEqual([]);
  });

  test('it is bounded per pass and stopped by its variable',async()=>{
    const many=[0,1,2,3].map(index=>item({reviewId:`review-${index}`,candidateId:`cand-${index}`}));
    const bounded=await adjudicateStandingGates(store(many),{at,gateAdjudicationLimit:2,runAgent:answer(EXHAUSTED)});
    expect(bounded).toHaveLength(2);
    expect(await adjudicateStandingGates(store(many),{at,gateAdjudicationEnabled:false,
      runAgent:async()=>{throw new Error('should not be called');}})).toEqual([]);
  });

  test('a failed adjudication is reported, not thrown away',async()=>{
    const outcomes=await adjudicateStandingGates(store([item()]),{at,
      runAgent:async()=>{throw new Error('provider refused');}});
    expect(outcomes).toEqual([expect.objectContaining({status:'adjudication-failed',error:'provider refused'})]);
  });

  // Adjudicating a gate that is about to be handed back to an agent spends a
  // model call on a question whose blockers are already changing.
  test('it runs after the dispatch and the apply step',()=>{
    const worker=fs.readFileSync(path.join(__dirname,'workflows/run-live-backoffice-worker.js'),'utf8');
    const dispatch=worker.indexOf('await dispatchUnansweredGates(store');
    const ingest=worker.indexOf('await ingestDossierReviews(store)');
    const adjudicate=worker.indexOf('await adjudicateStandingGates(store');
    expect(dispatch).toBeGreaterThan(-1);
    expect(adjudicate).toBeGreaterThan(ingest);
    expect(ingest).toBeGreaterThan(dispatch);
  });
});
