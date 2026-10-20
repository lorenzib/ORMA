'use strict';

const fs=require('fs');
const path=require('path');
const yaml=require('js-yaml');
const {SURVEY_MARKS,newestSurvey,surveyRecordsWhatItFound,surveyedBeforeTheMarks}
  =require('./workflows/resurvey-named-trails');
const {parseArgs,surveysByTrail,main}=require('./cli/resurvey-trails');

const ROOT=path.resolve(__dirname,'..');

/**
 * A re-survey is free -- the surveyor reads OpenStreetMap and measures, no
 * model call -- and it is the one thing that can move a trail while the model
 * credits are out. It could only be asked for by naming trails, and a list
 * typed out of a report is wrong the next morning.
 *
 * What makes a survey worth taking again is whether it says what it found. A
 * survey taken since 15 October carries one of three marks; an older one
 * carries none, and a walk with none cannot be told from a walk measured and
 * found to carry no numbers -- which is the distinction that answers
 * `route-number-sequence` and `route-number-switches` without paying anybody.
 */
describe('the record says which surveys predate the marks',()=>{
  const survey=(result,at='2026-10-17T00:00:00Z')=>
    ({agentId:'cartographer',jobId:'c',completedAt:at,result});

  test('each of the three marks counts as a survey that said what it found',()=>{
    expect([...SURVEY_MARKS].sort())
      .toEqual(['routeGuidance','routeNumbersAbsent','routeNumbersUnmeasured']);
    expect(surveyRecordsWhatItFound(survey({routeGuidance:{sequence:['20']}}))).toBe(true);
    expect(surveyRecordsWhatItFound(survey({routeNumbersAbsent:true}))).toBe(true);
    expect(surveyRecordsWhatItFound(survey({routeNumbersUnmeasured:'the fetch failed'}))).toBe(true);
  });

  test('and a survey from before them does not',()=>{
    expect(surveyRecordsWhatItFound(survey({relation:{tags:{ref:'20'}},geometry:{}}))).toBe(false);
    expect(surveyRecordsWhatItFound(survey({}))).toBe(false);
    expect(surveyRecordsWhatItFound(null)).toBe(false);
  });

  // "measured and found none" is recorded as `true`; absent is not the same
  // thing, and a falsy check would have read them alike.
  test('a mark that is present and false still says somebody looked',()=>{
    expect(surveyRecordsWhatItFound(survey({routeNumbersAbsent:false}))).toBe(true);
    expect(surveyRecordsWhatItFound(survey({routeNumbersAbsent:null}))).toBe(false);
  });

  test('only the cartographer writes a survey, and only the newest one counts',()=>{
    expect(newestSurvey([{agentId:'logistics',completedAt:'2026-10-18T00:00:00Z',result:{routeNumbersAbsent:true}}]))
      .toBeNull();
    const newest=newestSurvey([
      survey({},'2026-10-01T00:00:00Z'),
      survey({routeNumbersAbsent:true},'2026-10-17T00:00:00Z'),
    ]);
    expect(newest.result.routeNumbersAbsent).toBe(true);
  });

  test('a walk nobody has surveyed is not called stale',()=>{
    const orchestration={trails:[
      {trailId:'old',candidateId:'old',state:'evidence-research'},
      {trailId:'new',candidateId:'new',state:'red-team'},
      {trailId:'none',candidateId:'none',state:'geometry-audit'},
      {trailId:'done',candidateId:'done',state:'imported'},
    ]};
    const outputs=new Map([
      ['old',[survey({relation:{tags:{}}})]],
      ['new',[survey({routeGuidance:{sequence:['20']}})]],
      ['none',[]],
    ]);
    const found=surveyedBeforeTheMarks(orchestration,outputs);
    expect(found.stale.map(row=>row.trailId)).toEqual(['old']);
    expect(found.current.map(row=>row.trailId)).toEqual(['new']);
    expect(found.neverSurveyed.map(row=>row.trailId)).toEqual(['none']);
    // A trail resting is not waiting for anything.
    expect([...found.stale,...found.current,...found.neverSurveyed].map(row=>row.trailId))
      .not.toContain('done');
  });
});

describe('the command can ask instead of being told',()=>{
  test('--stale is a flag of its own, and composes with the rest',()=>{
    expect(parseArgs(['--stale'])).toEqual({trails:[],apply:false,stale:true});
    expect(parseArgs(['--stale','--apply'])).toEqual({trails:[],apply:true,stale:true});
    expect(parseArgs(['--trails','a,b'])).toEqual({trails:['a','b'],apply:false,stale:false});
  });

  function store(artifacts){
    const jobs=[];
    return {jobs,written:new Map(),
      async getArtifact(id){return artifacts[id]||null;},
      async setArtifact(id,value){this.written.set(id,value);},
      async putJob(job){jobs.push(job);}};
  }

  const orchestration={contractVersion:'1.0.0',trails:[
    {trailId:'old',candidateId:'old',trailName:'Old Walk',state:'evidence-research',
      attempts:{cartographer:1},jobIds:[],latestOutputRef:'firestore:trail-specialist-output-old-cartographer-1'},
    {trailId:'new',candidateId:'new',trailName:'New Walk',state:'red-team',
      attempts:{cartographer:1},jobIds:[],latestOutputRef:'firestore:trail-specialist-output-new-cartographer-1'},
  ]};
  const artifacts={
    'trail-orchestration':orchestration,
    'trail-specialist-output-old-cartographer-1':{source:{externalId:'relation/1'},geometry:{},relation:{tags:{}}},
    'trail-specialist-output-new-cartographer-1':{source:{externalId:'relation/2'},geometry:{},routeNumbersAbsent:true},
  };

  test('it reads the newest stored survey for each trail',async()=>{
    const outputs=await surveysByTrail(store(artifacts),orchestration);
    expect(outputs.get('old')[0].agentId).toBe('cartographer');
    expect(outputs.get('new')[0].result.routeNumbersAbsent).toBe(true);
  });

  test('a dry run names the stale walks and queues nothing',async()=>{
    const s=store(artifacts);
    const result=await main({store:s,argv:['--stale'],at:'2026-10-19T10:00:00Z'});
    expect(result.queueing.map(row=>row.candidateId)).toEqual(['old']);
    expect(s.jobs).toEqual([]);
    expect(s.written.size).toBe(0);
  });

  test('and with --apply it queues one free survey for each',async()=>{
    const s=store(artifacts);
    const result=await main({store:s,argv:['--stale','--apply'],at:'2026-10-19T10:00:00Z'});
    expect(s.jobs).toHaveLength(1);
    expect(s.jobs[0].agentId).toBe('cartographer');
    expect(s.jobs[0].candidateId).toBe('old');
    expect(result.queued).toHaveLength(1);
    // The trail does not move; only its survey is retaken.
    const written=s.written.get('trail-orchestration');
    expect(written.trails.find(trail=>trail.candidateId==='old').state).toBe('evidence-research');
  });

  test('and says so plainly when every survey is current',async()=>{
    const only={...artifacts,'trail-orchestration':{trails:[orchestration.trails[1]]}};
    const s=store(only);
    const result=await main({store:s,argv:['--stale','--apply'],at:'2026-10-19T10:00:00Z'});
    expect(result.stale).toEqual([]);
    expect(s.jobs).toEqual([]);
  });
});

describe('and it can be asked for without a terminal',()=>{
  const workflow=yaml.load(fs.readFileSync(
    path.join(ROOT,'.github/workflows/orma-requeue-fixed-jobs.yml'),'utf8'));
  const inputs=(workflow[true]||workflow.on).workflow_dispatch.inputs;
  const source=fs.readFileSync(path.join(ROOT,'.github/workflows/orma-requeue-fixed-jobs.yml'),'utf8');

  test('the workflow offers it as a checkbox',()=>{
    expect(inputs.resurvey_stale).toMatchObject({type:'boolean',default:false});
  });

  test('and the step runs on either way of asking, passing the flag',()=>{
    expect(source).toContain("if: inputs.resurvey_trail_ids != '' || inputs.resurvey_stale");
    expect(source).toContain('args+=(--stale)');
    // Still a dry run unless apply is ticked.
    expect(source).toContain('[resurvey] Dry run.');
  });
});
