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

function run(outputs,over={}){
  const jobs=outputs.map(output=>({id:output.jobId,candidateId:'osm-7548201',
    agentId:output.agentId,status:'completed',completedAt:'2026-10-15T12:00:00Z'}));
  const byId=new Map(outputs.map(output=>[output.jobId,output.result]));
  return gateDryRun({orchestration:{trails:[{trailId:'osm-7548201',candidateId:'osm-7548201',
    trailName:'Anello di Ciampeviei',state:'evidence-resolution',resolutionAttempts:{},...over}]},
    jobs,outputFor:id=>byId.get(id)||null,trailId:'osm-7548201'});
}

describe('the report says why, and never argues with itself',()=>{
  test('an answered claim that still blocks is reported as a fault',()=>{
    const outputs=[numberedRelation('69'),unresolvedClaim('route-number-switches')];
    const report=run(outputs);

    // The map answered it, as the report already said.
    const review={specialistOutputs:outputs.map(({agentId,result})=>({agentId,result}))};
    expect(supportedRouteGuidance(review,'route-number-switches').derivedFrom).toBe('route-relations');
    expect(report.routeGuidance.find(entry=>entry.claimId==='route-number-switches'))
      .toMatchObject({answered:true,from:'the map'});

    // And the gate still names it as what decides against the trail. That is
    // the live fault, and the report now states it instead of leaving two
    // numbers to be compared by eye.
    expect(report.unwaivable).toContain('logistics/route-number-switches');
    expect(report.overruledAnswers).toEqual(['logistics/route-number-switches']);
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
    // The report reads the catalogue as it stands; the decision recomputes
    // from the stored outputs alone. Pinning that they are two computations is
    // what makes a disagreement between them a reportable fault rather than a
    // surprise.
    const outputs=[numberedRelation('69'),unresolvedClaim('route-number-switches')]
      .map(output=>({agentId:output.agentId,result:output.result}));
    expect(currentBlockingReasons({specialistOutputs:outputs,blockingReasons:[],
      gateType:'dossier-approval'})).toContain('logistics/route-number-switches: unresolved');
  });
});
