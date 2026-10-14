'use strict';

const {gateDryRun,latestOutputsByAgent}=require('./workflows/gate-dry-run');
const {dossierBlockingReasons,ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier');

// A trail reaches the gate after six stages, and until it arrives nothing says
// what will happen when it does. Finding out meant pushing it -- five passes
// and an afternoon for Tre Cime -- then reading the answer out of a worker log.
// Every fault found that way cost a day.

const sourcedDirections=()=>({agentId:'logistics',jobId:'log-2',result:{
  recommendation:'advance',openQuestions:[],
  claims:ROUTE_GUIDANCE_CLAIM_IDS.map(id=>({id,category:'access',finding:'supported-proposal',
    proposedValue:'Start at Rifugio Auronzo and follow 101 to 105.',confidence:0.9,
    rationale:'Operator page.',
    sources:[{label:'Operator',url:'https://example.test/r',authority:'Consorzio Turistico'}],
    blockers:[]}))}});

const mapCartographer=()=>({agentId:'cartographer',jobId:'carto-1',result:{
  routeGuidance:{sequence:['101','105'],switches:[{from:'101',to:'105',km:4.2}],segments:[]},
  relation:{tags:{ref:'101'}},
  source:{relations:[{externalRelationId:'relation/1484751',ref:'101'},
    {externalRelationId:'relation/6678431',ref:'105'}]}}});

const startAndStatusOnly=()=>({agentId:'logistics',jobId:'log-1',result:{
  recommendation:'advance',openQuestions:[],
  claims:['recommended-start','route-number-status'].map(id=>({id,category:'access',
    finding:'supported-proposal',proposedValue:'Start at Rifugio Auronzo.',confidence:0.9,
    rationale:'Operator page.',
    sources:[{label:'Operator',url:'https://example.test/r',authority:'Consorzio Turistico'}],
    blockers:[]}))}});

const orchestration=(over={})=>({trails:[{trailId:'tre-cime',candidateId:'tre-cime',
  trailName:'Tre Cime di Lavaredo',state:'evidence-resolution',resolutionAttempts:{},...over}]});

function run(outputs,over={}){
  const jobs=outputs.map(output=>({id:output.jobId,candidateId:'tre-cime',
    agentId:output.agentId,status:'completed',completedAt:'2026-10-14T12:00:00Z'}));
  const byId=new Map(outputs.map(output=>[output.jobId,output.result]));
  return gateDryRun({orchestration:orchestration(over),jobs,
    outputFor:id=>byId.get(id)||null,trailId:'tre-cime'});
}

describe('asking the gate before the trail arrives',()=>{
  test('a trail nobody is orchestrating says so rather than guessing',()=>{
    expect(gateDryRun({orchestration:orchestration(),jobs:[],trailId:'nobody'}))
      .toEqual({found:false,trailId:'nobody'});
  });

  test('it names which agents have reported and which have not',()=>{
    const report=run([startAndStatusOnly()]);
    expect(report.agentsReporting).toEqual(['logistics']);
    expect(report.missingAgents).toEqual(['regulatoryRanger','terrainPoi']);
  });

  test('it says where each direction answer comes from',()=>{
    const report=run([sourcedDirections()]);
    expect(report.routeGuidance.every(claim=>claim.answered)).toBe(true);
    expect(report.routeGuidance.every(claim=>claim.from==='an authority')).toBe(true);
    expect(report.routeGuidance[0].authority).toBe('Consorzio Turistico');
    expect(report.routeGuidanceBlockers).toEqual([]);
  });

  test('it distinguishes an answer read from the map from an authority’s',()=>{
    // The question that has taken longest to answer by hand.
    const report=run([startAndStatusOnly(),mapCartographer()]);
    const by=Object.fromEntries(report.routeGuidance.map(claim=>[claim.claimId,claim.from]));
    expect(by['recommended-start']).toBe('an authority');
    expect(by['route-number-status']).toBe('an authority');
    expect(by['route-number-sequence']).toBe('the map');
    expect(by['route-number-switches']).toBe('the map');
    expect(report.routeGuidanceBlockers).toEqual([]);
  });

  test('an unanswered direction is named, and is what decides the trail',()=>{
    const report=run([startAndStatusOnly()]);
    expect(report.routeGuidance.filter(claim=>!claim.answered).map(claim=>claim.claimId))
      .toEqual(['route-number-sequence','route-number-switches']);
    expect(report.unwaivable).toEqual(['logistics/route-number-sequence','logistics/route-number-switches']);
  });

  test('it reports the decision the policy would actually take',()=>{
    const report=run([sourcedDirections()]);
    expect(['approve','request-revision','reject']).toContain(report.wouldDecide);
  });

  test('it counts blockers exactly as the gate counts them',()=>{
    // Not a second opinion: the same function, over the same outputs.
    const outputs=[startAndStatusOnly()];
    const report=run(outputs);
    expect(report.blockerCount).toBe(dossierBlockingReasons(outputs).length);
  });

  test('only the newest completed job from each agent is read',()=>{
    const jobs=[
      {id:'old',candidateId:'t',agentId:'logistics',status:'completed',completedAt:'2026-10-01T00:00:00Z'},
      {id:'new',candidateId:'t',agentId:'logistics',status:'completed',completedAt:'2026-10-14T00:00:00Z'},
      {id:'running',candidateId:'t',agentId:'terrainPoi',status:'running'},
    ];
    const outputs=latestOutputsByAgent(jobs,'t',id=>({id}));
    expect(outputs.map(output=>output.jobId)).toEqual(['new']);
  });
});
