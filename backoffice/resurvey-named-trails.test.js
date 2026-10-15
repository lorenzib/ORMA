'use strict';

const {planResurvey,withAnotherSurvey,surveyAttempt,named,
  RESTING}=require('./workflows/resurvey-named-trails');
const {parseArgs}=require('./cli/resurvey-trails');

// The geometry audit is deterministic and free, and it is where the map reading
// lives -- so every improvement to it is invisible to a trail already past it,
// and nothing in the pipeline goes backwards.
//
// That cost three improvements their effect on 15 October 2026: the route number
// sitting unread in a stored audit, the numbered routes running along a walk
// that carries none, and the mark saying somebody looked and found none. Five of
// the eight trails still blocked had moved past the survey and could never
// benefit from a better one.

const trail=(over={})=>({trailId:'osm-6250300',candidateId:'osm-6250300',
  trailName:'Boucle du Lac Vert',state:'evidence-resolution',
  attempts:{cartographer:1,logistics:3},jobIds:['job-a','job-b'],...over});

const orchestration=(...trails)=>({trails});

describe('surveying a named trail again',()=>{
  test('a trail past the survey gets a fresh one queued, and stays put',()=>{
    const plan=planResurvey(orchestration(trail()),['osm-6250300']);
    expect(plan.queueing).toEqual([{trailId:'osm-6250300',candidateId:'osm-6250300',
      trailName:'Boucle du Lac Vert',state:'evidence-resolution'}]);
    expect(plan.surveying).toEqual([]);
    expect(plan.unknown).toEqual([]);
  });

  test('the trail is not sent back a stage, which would stall it',()=>{
    // `reconsider-rejected-trails` resets the stage and sets reconsideredAt,
    // and that marks every agent's evidence as predating the return -- so a
    // trail sent back for a survey would stall at evidence-research waiting on
    // research nobody queued.
    const before=trail();
    const after=withAnotherSurvey(before,'job-new');
    expect(after.state).toBe('evidence-resolution');
    expect(after.reconsideredAt).toBeUndefined();
    expect(after.gate).toBeUndefined();
    // The research already paid for is untouched.
    expect(after.attempts.logistics).toBe(3);
    expect(after.jobIds).toEqual(['job-a','job-b','job-new']);
  });

  test('the attempt moves, because the job id is built from the count',()=>{
    expect(surveyAttempt(trail())).toBe(2);
    expect(withAnotherSurvey(trail(),'job-new').attempts.cartographer).toBe(2);
    // A trail never surveyed starts at one.
    expect(surveyAttempt({})).toBe(1);
  });

  test('a trail already at the survey is held, and said so',()=>{
    const plan=planResurvey(orchestration(trail({state:'geometry-audit'})),['osm-6250300']);
    expect(plan.queueing).toEqual([]);
    expect(plan.surveying).toHaveLength(1);
  });

  test('a resting trail is not waiting on a survey',()=>{
    for(const state of RESTING){
      const plan=planResurvey(orchestration(trail({state})),['osm-6250300']);
      expect(plan.queueing).toEqual([]);
      expect(plan.resting[0]).toMatchObject({state});
    }
    // A rejection has its own way back, which needs the stage reset this avoids.
    expect(RESTING).toContain('rejected');
  });

  test('a trail is found by either of its two ids, which are not always equal',()=>{
    const curated=trail({trailId:'cinque-torri-assisted',candidateId:'candidate-99'});
    expect(named(orchestration(curated),['cinque-torri-assisted']).trails).toHaveLength(1);
    expect(named(orchestration(curated),['candidate-99']).trails).toHaveLength(1);
  });

  test('a name that is not in the pipeline is reported, not silently dropped',()=>{
    const plan=planResurvey(orchestration(trail()),['osm-6250300','osm-nonsense']);
    expect(plan.unknown).toEqual(['osm-nonsense']);
    expect(plan.queueing).toHaveLength(1);
  });

  test('naming nothing does nothing',()=>{
    expect(planResurvey(orchestration(trail()),[]))
      .toEqual({queueing:[],surveying:[],resting:[],unknown:[]});
    expect(named(orchestration(trail()),null).trails).toEqual([]);
  });

  test('it is a dry run until told otherwise',()=>{
    expect(parseArgs(['--trails','a,b'])).toEqual({trails:['a','b'],apply:false});
    expect(parseArgs(['--trails=a, b','--apply'])).toEqual({trails:['a','b'],apply:true});
    expect(parseArgs([])).toEqual({trails:[],apply:false});
  });
});
