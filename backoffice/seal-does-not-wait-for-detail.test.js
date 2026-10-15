'use strict';

const {advanceTrailOrchestration,
  directionsSettledWithoutAgents}=require('./workflows/advance-trail-orchestration');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');

// Eight stages and about eight jobs a trail, three worker passes a day: four
// trails a day, forty days for 162, three months for a thousand. Five of those
// jobs are model calls producing optional detail that half the time comes back
// unknown.
//
// And since the map and ORMA's own record learned to answer the four
// unwaivable claims, none of those calls decides whether a trail is verified.
// 152 of the catalogue's 162 trails hold everything the four need. On 16
// October the credits ran out and seven trails sat blocked behind agents that
// had nothing to add to them.

const TRAIL={id:'osm-11839597',name:'Fenn Promenade',
  startPoint:{lat:46.8,lng:11.9,label:'Start here: the village car park'},
  decisionPoints:[],rifugi:[]};

/** A survey that settled the numbers, as the cartographer writes one. */
const survey=()=>({routeGuidance:singleRelationGuidance({tags:{ref:'20'}}),
  relation:{tags:{ref:'20',name:'Fenn Promenade'}},source:{externalId:'relation/11839597'}});

function store(over={}){
  const artifacts={'trail-orchestration':{contractVersion:'1.0.0',trails:[{
    trailId:'osm-11839597',candidateId:'osm-11839597',trailName:'Fenn Promenade',
    state:'evidence-research',stage:'evidence-gathering',attempts:{cartographer:1},
    jobIds:['carto-1'],blockers:[],...over.trail}]},
    'dossier-review-queue':{contractVersion:'1.0.0',items:[]},
    'trail-specialist-output-carto-1':over.result===undefined?survey():over.result,
    ...over.artifacts};
  const jobs=over.jobs||[{id:'carto-1',candidateId:'osm-11839597',agentId:'cartographer',
    status:'completed',completedAt:'2026-10-16T09:00:00Z',createdAt:'2026-10-16T09:00:00Z'}];
  const written={};
  return {written,
    getArtifact:async id=>artifacts[id]||null,
    setArtifact:async(id,value)=>{written[id]=value;artifacts[id]=value;},
    listJobs:async()=>jobs, putJob:async()=>{}, jobs};
}

const run=s=>advanceTrailOrchestration(s,{at:'2026-10-16T10:00:00Z',productionTrails:[TRAIL]});

describe('a seal does not wait for optional detail',()=>{
  test('a trail whose survey settled the directions goes straight to the gate',async()=>{
    const s=store();
    const out=await run(s);
    expect(out.advanced).toEqual(['osm-11839597']);
    const trail=s.written['trail-orchestration'].trails[0];
    expect(trail.state).toBe('dossier-human-gate');
    expect(trail.stage).toBe('directions-settled-by-survey');
    // And the gate it arrives at can approve it, with nothing outstanding.
    const item=s.written['dossier-review-queue'].items[0];
    expect(item.gateType).toBe('dossier-approval');
    expect(item.approvalAllowed).toBe(true);
    expect(item.blockingReasons).toEqual([]);
    expect(item.specialistOutputs.map(o=>o.agentId)).toEqual(['cartographer']);
  });

  test('no model job is queued to get there',async()=>{
    const queued=[];
    const s=store();
    s.putJob=async job=>{queued.push(job);};
    await run(s);
    expect(queued).toEqual([]);
  });

  test('a trail whose directions are not settled waits for the agents, as before',async()=>{
    // No number on the relation and no catalogue record to fall back on.
    const s=store({result:{relation:{tags:{name:'Unnumbered'}},source:{externalId:'relation/1'}}});
    const out=await advanceTrailOrchestration(s,{at:'2026-10-16T10:00:00Z',productionTrails:[]});
    expect(out.advanced).toEqual([]);
    expect(s.written['trail-orchestration']).toBeUndefined();
  });

  test('a trail already part-way through research keeps its research',async()=>{
    // Overtaking it would throw away work already paid for.
    const jobs=[{id:'carto-1',candidateId:'osm-11839597',agentId:'cartographer',
      status:'completed',completedAt:'2026-10-16T09:00:00Z',createdAt:'2026-10-16T09:00:00Z'},
      {id:'log-1',candidateId:'osm-11839597',agentId:'logistics',status:'completed',
        completedAt:'2026-10-16T09:30:00Z',createdAt:'2026-10-16T09:30:00Z'}];
    const s=store({trail:{jobIds:['carto-1','log-1']},jobs});
    await run(s);
    const trail=s.written['trail-orchestration']?.trails?.[0];
    expect(trail?.stage).not.toBe('directions-settled-by-survey');
  });

  test('with no survey at all it does not go anywhere',async()=>{
    expect(directionsSettledWithoutAgents([],TRAIL)).toBe(false);
    expect(directionsSettledWithoutAgents([{agentId:'logistics',result:{}}],TRAIL)).toBe(false);
  });

  test('the four directions are what it asks about, nothing else',async()=>{
    // A survey that settled them, for a trail the catalogue knows.
    expect(directionsSettledWithoutAgents([{agentId:'cartographer',result:survey()}],TRAIL)).toBe(true);
    // And without the catalogue, the two ORMA answers are unanswered.
    expect(directionsSettledWithoutAgents([{agentId:'cartographer',result:survey()}],null)).toBe(false);
  });
});
