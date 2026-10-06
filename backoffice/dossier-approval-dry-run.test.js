'use strict';

const {main}=require('./cli/check-dossier-approval');
const {summariseOutput}=require('./workflows/review-queue-compaction');

const sourced=[{url:'https://comune.example/start',authority:'Comune di Example',label:'Official guide'}];
const claim=id=>({id,category:'logistics',finding:'supported-proposal',
  proposedValue:`A real value for ${id}`,sources:sourced,blockers:[]});
const cartResult={geometry:{type:'LineString',coordinates:[[11.9,46.6],[11.91,46.61]]},
  relation:{tags:{name:'Example Trail'}},assessment:{pointCount:2,distanceKm:9.5},
  source:{externalId:'relation/1',endpoint:'https://overpass.example',relationVersion:'4',
    relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL',url:'https://osm.example/relation/1',authority:'OpenStreetMap'},
  routeConformance:{status:'conformant',offRouteKm:0,maxDeviationMetres:12}};
const logResult={recommendation:'advance',openQuestions:[],claims:[claim('recommended-start')]};
const outputs=[{agentId:'cartographer',jobId:'jc',result:cartResult},
  {agentId:'logistics',jobId:'jl',result:logResult}];
const item=specialistOutputs=>({reviewId:'r1',trailId:'osm-1',candidateId:'osm-1',trailName:'Example Trail',
  gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:true,blockingReasons:[],specialistOutputs});

const store=(specialistOutputs,extra={})=>{
  const written=[];
  return {written,
    getArtifact:async id=>({
      'dossier-review-queue':{contractVersion:'1.0.0',items:[item(specialistOutputs)]},
      'trail-orchestration':{trails:[{candidateId:'osm-1',trailId:'osm-1',trailName:'Example Trail'}]},
      'trail-specialist-output-jc':cartResult,'trail-specialist-output-jl':logResult,
      ...extra,
    })[id]||null,
    setArtifact:async(id,value)=>{written.push({id,value});},
  };
};

describe('asking whether an approval would land, without making one',()=>{
  test('a summarised dossier reports that it would compile, once the pointer is followed',async()=>{
    const s=store(outputs.map(summariseOutput));
    const [result]=await main({argv:[],store:s});
    expect(result).toEqual(expect.objectContaining({wouldCompile:true,detailRestored:true,error:null}));
  });

  test('it writes nothing at all',async()=>{
    // The whole point: no review, no registry entry, nobody recorded as having
    // judged anything.
    const s=store(outputs.map(summariseOutput));
    await main({argv:[],store:s});
    expect(s.written).toEqual([]);
  });

  test('a dossier that genuinely cannot compile says why',async()=>{
    const unsourced=[{agentId:'cartographer',jobId:'jc',result:cartResult},
      {agentId:'logistics',jobId:'jl',result:{...logResult,claims:[{...claim('recommended-start'),sources:[]}]}}];
    const [result]=await main({argv:[],store:store(unsourced,{'trail-specialist-output-jl':null})});
    expect(result.wouldCompile).toBe(false);
    expect(result.error).toMatch(/requires a sourced recommended start/);
  });

  test('blockers a moderator would accept are reported as the decision, not a failure',async()=>{
    const withBlockers=[{agentId:'cartographer',jobId:'jc',result:cartResult},
      {agentId:'logistics',jobId:'jl',result:{...logResult,recommendation:'needs-resolution',
        openQuestions:['Is the car park open on the day?']}}];
    const [result]=await main({argv:[],store:store(withBlockers)});
    expect(result.blockersToAccept).toBeGreaterThan(0);
    expect(result.wouldCompile).toBe(true);
  });

  test('an agent refusing outright is reported above the pile of loose ends',async()=>{
    // Lac de la Thuile printed 69 blockers as one paragraph, which buried the
    // only line that decided anything: two agents saying block.
    const {blockingAgents,byAgent,shortError}=require('./cli/check-dossier-approval');
    const reasons=['redTeam: recommendation is block','evidenceLibrarian: recommendation is block',
      'redTeam/water-fountain: counter-evidence','logistics: open question — is the car park open?'];
    expect(blockingAgents(reasons)).toEqual(['evidenceLibrarian','redTeam']);
    expect(byAgent(reasons)).toEqual([['redTeam',2],['evidenceLibrarian',1],['logistics',1]]);
  });

  test('the compiler restating every blocker is cut to its point',async()=>{
    const {shortError}=require('./cli/check-dossier-approval');
    // The message lists the whole dossier's unfinished business; the blockers
    // are reported in their own right just below it.
    expect(shortError('A blocked dossier cannot be compiled as verified: a; b; c'))
      .toBe('the blockers below have not been accepted');
    // A genuine machinery refusal keeps its own words.
    expect(shortError('Trail requires a sourced recommended start before verification: recommended-start'))
      .toMatch(/requires a sourced recommended start/);
  });

  test('every blocker still reaches the JSON, only the printing is trimmed',async()=>{
    const many=Array.from({length:30},(_,index)=>({id:'x',note:index}));
    const withBlockers=[{agentId:'cartographer',jobId:'jc',result:cartResult},
      {agentId:'logistics',jobId:'jl',result:{...logResult,recommendation:'needs-resolution',
        openQuestions:many.map(entry=>`Question ${entry.note}`)}}];
    const [result]=await main({argv:[],store:store(withBlockers)});
    expect(result.blockers.length).toBeGreaterThan(10);
    expect(result.blockersByAgent[0][0]).toBe('logistics');
  });

  test('it can be pointed at one trail',async()=>{
    expect(await main({argv:['--candidate','osm-does-not-exist'],store:store(outputs)})).toEqual([]);
  });
});
