'use strict';

const {gateDryRun}=require('./workflows/gate-dry-run');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');

// Every branch of the survey records exactly one of three things: the numbers it
// found, that it looked along the walk and found none, or that it could not
// look. So a survey carrying none of them is older than those marks -- and from
// the gate that is indistinguishable from a walk nobody can supply directions
// for.
//
// Seven trails read that way on 16 October 2026 after a fresh survey, and
// working out why meant reading commit timestamps against workflow run times,
// because the report would not say which of the four it was.

const run=result=>gateDryRun({
  orchestration:{trails:[{trailId:'osm-14864704',candidateId:'osm-14864704',
    trailName:'Boucle du Taillefer',state:'evidence-resolution',resolutionAttempts:{}}]},
  jobs:[{id:'carto-1',candidateId:'osm-14864704',agentId:'cartographer',
    status:'completed',completedAt:'2026-10-16T09:00:00Z'}],
  outputFor:()=>result,trailId:'osm-14864704'});

const base={relation:{tags:{name:'Boucle du Taillefer'}},source:{externalId:'relation/14864704'}};

describe('the report says what the survey holds',()=>{
  test('numbers found are named',()=>{
    expect(run({...base,routeGuidance:singleRelationGuidance({tags:{ref:'23'}})}).surveyRecorded)
      .toBe('numbers: 23');
  });

  test('looked and found none says so',()=>{
    expect(run({...base,routeNumbersAbsent:true}).surveyRecorded)
      .toBe('looked along the walk and found no number');
  });

  test('could not look carries the reason',()=>{
    expect(run({...base,routeNumbersUnmeasured:'fetch failed'}).surveyRecorded)
      .toBe('could not look: fetch failed');
  });

  test('a survey too old to say says that, and not that the walk has no number',()=>{
    // The case that cost an afternoon: a survey predating the marks reads from
    // the gate exactly like a walk nobody wrote directions for.
    expect(run(base).surveyRecorded)
      .toBe('nothing — this survey predates the marks, so it cannot say either way');
  });

  test('no survey at all is its own answer',()=>{
    expect(run(null).surveyRecorded).toBe('no survey on the shelf');
  });

  test('the four are distinct, so none can be mistaken for another',()=>{
    const said=[
      run({...base,routeGuidance:singleRelationGuidance({tags:{ref:'23'}})}).surveyRecorded,
      run({...base,routeNumbersAbsent:true}).surveyRecorded,
      run({...base,routeNumbersUnmeasured:'fetch failed'}).surveyRecorded,
      run(base).surveyRecorded,
    ];
    expect(new Set(said).size).toBe(4);
  });
});
