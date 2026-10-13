'use strict';

const {planReconsideration,returnedTrail,rejectionReasons,rejectedTrails,reviewerFor}
  =require('./workflows/reconsider-rejected-trails');
const {main}=require('./cli/reconsider-rejected-trails');

/**
 * `requeue-fixed-jobs` releases a blocked job whose cause was fixed. A rejected
 * trail had no equivalent, and rejection is terminal — so #748's closure
 * tolerance reached every trail still moving and none of the ones it would have
 * saved. "Boucle du Taillefer" is the case: rejected at 101 m against a flat
 * 100 m, and the rule that would pass it at 134 m arrived a day late.
 */

const at='2026-10-13T12:00:00.000Z';
const trail=(id,state,blockers,extra={})=>({trailId:id,candidateId:id,trailName:id,
  state,blockers,attempts:{cartographer:6},jobIds:['old-job'],...extra});
const world=()=>({trails:[
  trail('taillefer','rejected',['not-closed-loop']),
  trail('beatrice','rejected',['official-distance-conflict','disconnected-components']),
  trail('still-going','red-team',[]),
]});

describe('which rejected trails can be looked at again',()=>{
  test('only rejected trails are candidates',()=>{
    expect(rejectedTrails(world()).map(t=>t.trailId)).toEqual(['taillefer','beatrice']);
  });

  // Naming the reason is the whole discipline: most rejections were correct.
  test('with no reason it reports what they were rejected for and changes nothing',()=>{
    const plan=planReconsideration(world());
    expect(plan.returning).toEqual([]);
    expect(plan.reasons).toEqual([
      {reason:'not-closed-loop',count:1},
      {reason:'official-distance-conflict',count:1},
      {reason:'disconnected-components',count:1},
    ]);
  });

  test('a named reason takes only the trails that carry it',()=>{
    const plan=planReconsideration(world(),{reason:'not-closed-loop'});
    expect(plan.returning.map(e=>e.trailId)).toEqual(['taillefer']);
  });

  test('a reason nothing carries returns nothing rather than everything',()=>{
    expect(planReconsideration(world(),{reason:'livestock'}).returning).toEqual([]);
  });

  test('a reason containing regex characters is matched literally',()=>{
    const plan=planReconsideration({trails:[trail('t','rejected',['gap (101 m)'])]},{reason:'gap (101 m)'});
    expect(plan.returning).toHaveLength(1);
  });

  test('the pass is bounded and says what it held back',()=>{
    const many={trails:Array.from({length:5},(_,i)=>trail('t'+i,'rejected',['not-closed-loop']))};
    const plan=planReconsideration(many,{reason:'not-closed-loop',limit:2});
    expect(plan.returning).toHaveLength(2);
    expect(plan.held).toBe(3);
  });

  test('a geometry fault goes back to the cartographer, not to evidence',()=>{
    const [entry]=planReconsideration(world(),{reason:'not-closed-loop'}).returning;
    expect(entry).toEqual(expect.objectContaining({agentId:'cartographer',state:'geometry-audit'}));
    expect(reviewerFor(['not-closed-loop'])).toBe('cartographer');
  });
});

describe('what going back actually means',()=>{
  const entry={agentId:'cartographer',state:'geometry-audit',stage:'route-identity-and-geometry'};

  test('the rejection and its gate are cleared',()=>{
    const next=returnedTrail(trail('t','rejected',['not-closed-loop'],{gate:{status:'rejected'}}),entry,at);
    expect(next.state).toBe('geometry-audit');
    expect(next.gate).toBeNull();
    expect(next.blockers).toEqual([]);
    expect(next.reconsideredFrom).toBe('rejected');
  });

  // A replay of the attempt that failed would be judged on the same stored
  // output; the counter has to move for the pass to be a new one.
  test('the attempt counter advances',()=>{
    expect(returnedTrail(trail('t','rejected',[]),entry,at).attempts.cartographer).toBe(7);
  });

  test('a trail with no attempt history starts at one',()=>{
    expect(returnedTrail({trailId:'t',state:'rejected'},entry,at).attempts.cartographer).toBe(1);
  });
});

describe('the pass end to end',()=>{
  const store=orchestration=>{
    const jobs=[];const artifacts={'trail-orchestration':orchestration};
    return {jobs,artifacts,getArtifact:async id=>artifacts[id]||null,
      setArtifact:async(id,v)=>{artifacts[id]=v;},putJob:async j=>{jobs.push(j);}};
  };

  test('a dry run changes nothing',async()=>{
    const subject=store(world());
    await main({store:subject,at,argv:['--reason','not-closed-loop']});
    expect(subject.jobs).toEqual([]);
    expect(subject.artifacts['trail-orchestration'].trails[0].state).toBe('rejected');
  });

  test('applying it sends the trail back and queues a fresh pass',async()=>{
    const subject=store(world());
    const result=await main({store:subject,at,argv:['--reason','not-closed-loop','--apply']});
    expect(result.queued).toHaveLength(1);
    expect(subject.jobs[0]).toEqual(expect.objectContaining({agentId:'cartographer',candidateId:'taillefer'}));
    const saved=subject.artifacts['trail-orchestration'].trails.find(t=>t.trailId==='taillefer');
    expect(saved.state).toBe('geometry-audit');
    expect(saved.jobIds).toContain(subject.jobs[0].id);
  });

  test('the trails it did not name are untouched',async()=>{
    const subject=store(world());
    await main({store:subject,at,argv:['--reason','not-closed-loop','--apply']});
    expect(subject.artifacts['trail-orchestration'].trails.find(t=>t.trailId==='beatrice').state).toBe('rejected');
    expect(subject.artifacts['trail-orchestration'].trails.find(t=>t.trailId==='still-going').state).toBe('red-team');
  });
});
