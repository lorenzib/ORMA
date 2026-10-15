'use strict';

const {gateDryRun}=require('./workflows/gate-dry-run');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {ROUTE_GUIDANCE_CLAIM_IDS,currentBlockingReasons,
  supportedRouteGuidance}=require('./workflows/compile-verified-dossier');

// Two live trails read as a self-contradiction on 15 October 2026, and finding
// out why took an afternoon of reading the gate by hand.
//
// Anello di Ciampeviei: all four directions answered -- three by the Lozzo di
// Cadore authority, switches by the map -- and the next line said "Cannot be
// waived, so these decide it: logistics/route-number-switches". Answered and
// blocking, on consecutive lines of the same report.
//
// Fenn Promenade: all four answered, nothing unwaivable, zero blockers, and the
// gate still rejected it for two of the four being required.
//
// In the sweep both printed as `cannot: nothing unwaivable` -- a sentence that
// argues with itself -- so six trails coming free looked like nothing had
// changed. The report must say which of these it is, because a walk nobody
// published directions for and ORMA arguing with itself want completely
// different work.

/** The audit for a single numbered relation, as the cartographer writes it. */
const numberedRelation=ref=>({agentId:'cartographer',jobId:'carto-1',result:{
  // Derived, never retyped: a hand-written copy passes against a shape nothing
  // emits.
  routeGuidance:singleRelationGuidance({tags:{ref}}),
  relation:{tags:{ref}},
  source:{externalId:'relation/7548201'},
}});

/** Logistics reporting a route claim it could not settle. */
const unresolvedClaim=claimId=>({agentId:'logistics',jobId:'log-1',result:{
  recommendation:'needs-resolution',openQuestions:[],
  claims:[
    {id:claimId,category:'route',finding:'unresolved',proposedValue:'',confidence:0.2,
      rationale:'No published description names where the number changes.',sources:[],blockers:[]},
    ...ROUTE_GUIDANCE_CLAIM_IDS.filter(id=>id!==claimId).map(id=>({id,category:'route',
      finding:'supported-proposal',proposedValue:'Start at the village car park and follow 69.',
      confidence:0.9,rationale:'Operator page.',
      sources:[{label:'Comune',url:'https://example.test/lozzo',
        authority:'Lozzo di Cadore / Parco Sentieristico Terre Alte'}],blockers:[]})),
  ]}});

// The catalogue's own record of the walk: a named start with coordinates, which
// 161 of the 162 trails carry.
const START={id:'osm-7548201',name:'Anello di Ciampeviei',
  startPoint:{label:'Village car park',lat:46.47,lng:12.47}};

function run(outputs,over={},trail=null){
  const jobs=outputs.map(output=>({id:output.jobId,candidateId:'osm-7548201',
    agentId:output.agentId,status:'completed',completedAt:'2026-10-15T12:00:00Z'}));
  const byId=new Map(outputs.map(output=>[output.jobId,output.result]));
  return gateDryRun({orchestration:{trails:[{trailId:'osm-7548201',candidateId:'osm-7548201',
    trailName:'Anello di Ciampeviei',state:'evidence-resolution',resolutionAttempts:{},...over}]},
    jobs,outputFor:id=>byId.get(id)||null,trailId:'osm-7548201',trail});
}

describe('the report says why, and never argues with itself',()=>{
  test('an answered claim that still blocks is reported as a fault',()=>{
    // The still-live disagreement, and the one that is harder to see: ORMA's
    // own record answers in the report, which reads the catalogue as it stands,
    // and cannot answer in the decision, which recomputes from the stored
    // outputs alone and is never handed the trail. Fenn Promenade read that way
    // -- all four answered, nothing unwaivable, zero blockers, reject.
    //
    // This fixture was first written round the map and a claim the agent could
    // not settle. That is the fault the very next change removed, so the test
    // became one forbidding its own fix: a test that pins a live bug as its
    // fixture outlives the bug.
    const report=run([numberedRelation('69'),unresolvedClaim('recommended-start')],{},START);

    // The report can see it, because it was given the catalogue.
    expect(report.routeGuidance.find(entry=>entry.claimId==='recommended-start'))
      .toMatchObject({answered:true,from:"ORMA's own record"});

    // The report's own blocker list agrees it is answered -- it had the
    // catalogue too -- so nothing in the report looks wrong.
    expect(report.unwaivable).not.toContain('logistics/recommended-start');
    // And the decision, which had no catalogue, rejects for exactly that
    // claim. That is the contradiction, and it is now stated rather than left
    // to be spotted across two halves of a report.
    expect(report.overruledAnswers).toEqual(['logistics/recommended-start']);
    expect(report.wouldDecideWhenResearchEnds).toBe('reject');
    expect(report.note).toContain('logistics/recommended-start');
  });

  test('a genuinely unanswered claim is not a fault, just a blocker',()=>{
    // Eight of the catalogue's blocked trails carry no number at all. Nothing
    // is contradicting itself there -- nobody published directions.
    const report=run([numberedRelation(null),unresolvedClaim('route-number-switches')]);
    expect(report.routeGuidance.find(entry=>entry.claimId==='route-number-switches').answered).toBe(false);
    expect(report.unwaivable).toContain('logistics/route-number-switches');
    expect(report.overruledAnswers).toEqual([]);
  });

  test('nothing standing and nothing contradicted leaves no fault to report',()=>{
    const report=run([numberedRelation('69')]);
    expect(report.overruledAnswers).toEqual([]);
  });

  test("ORMA's own record is never reported as an authority",()=>{
    // The weakest of the three sources was reading as "answered by an
    // authority - ORMA", which is the one thing the standard says it must
    // never read as.
    const trail={id:'osm-7548201',name:'Anello di Ciampeviei',
      startPoint:{label:'Village car park',lat:46.47,lng:12.47}};
    const report=gateDryRun({orchestration:{trails:[{trailId:'osm-7548201',
      candidateId:'osm-7548201',trailName:'Anello di Ciampeviei',state:'evidence-research',
      resolutionAttempts:{}}]},
      jobs:[{id:'carto-1',candidateId:'osm-7548201',agentId:'cartographer',
        status:'completed',completedAt:'2026-10-15T12:00:00Z'}],
      outputFor:()=>numberedRelation('69').result,trailId:'osm-7548201',trail});
    const start=report.routeGuidance.find(entry=>entry.claimId==='recommended-start');
    expect(start.answered).toBe(true);
    expect(start.from).toBe("ORMA's own record");
    expect(start.from).not.toBe('an authority');
    // The map's two still say the map.
    expect(report.routeGuidance.find(entry=>entry.claimId==='route-number-sequence').from)
      .toBe('the map');
  });

  test('the gate recomputes its own blockers, which is where the two can part',()=>{
    // The report reads the catalogue as it stands; the decision recomputes from
    // the stored outputs alone and is handed no trail, so ORMA's own record
    // cannot answer there. Pinning that they are two computations is what makes
    // a disagreement between them a reportable fault rather than a surprise.
    const outputs=[numberedRelation('69'),unresolvedClaim('recommended-start')]
      .map(({agentId,result})=>({agentId,result}));
    expect(currentBlockingReasons({specialistOutputs:outputs,blockingReasons:[],
      gateType:'dossier-approval'})).toContain('logistics/recommended-start: unresolved');
    // The map's two are answered out of the audit itself, which the decision
    // can read as well, so those two never part.
    expect(supportedRouteGuidance({specialistOutputs:[outputs[0]]},'route-number-switches')
      .derivedFrom).toBe('route-relations');
    expect(currentBlockingReasons({specialistOutputs:outputs,blockingReasons:[],
      gateType:'dossier-approval'})).not.toContain('logistics/route-number-switches: unresolved');
  });
});
