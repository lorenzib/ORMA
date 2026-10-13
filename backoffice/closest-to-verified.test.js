'use strict';

const {closestToVerified,classifyBlockers,directionsSettled,stageIndex,STAGES}
  =require('./workflows/closest-to-verified');
const {waiting}=require('./cli/report-closest-to-verified');
const {UNWAIVABLE_BLOCKER_IDS}=require('./workflows/compile-verified-dossier');

/**
 * Every other report answers a stage-shaped question. None answered the one
 * actually asked: which trail is closest, and what stands between it and the
 * seal.
 */

const trail=(id,state,blockers=[],claimResolution={})=>
  ({trailId:id,trailName:id,state,blockers,claimResolution});

describe('what actually stops a trail',()=>{
  test('a line fault and a directions fault are counted apart',()=>{
    const c=classifyBlockers(['not-closed-loop','logistics/route-number-switches: required','terrainPoi/shade: exhausted']);
    expect(c.line).toEqual(['not-closed-loop']);
    expect(c.directions).toEqual(['logistics/route-number-switches']);
    expect(c.waivable).toBe(1);
    expect(c.total).toBe(3);
  });

  // The whole claim this report rests on: everything else is waivable.
  test('every unwaivable blocker is one of those two kinds',()=>{
    const c=classifyBlockers(UNWAIVABLE_BLOCKER_IDS);
    expect(c.line.length+c.directions.length).toBe(UNWAIVABLE_BLOCKER_IDS.length);
    expect(c.waivable).toBe(0);
    expect(c.directions).toHaveLength(4);
  });

  test('an optional blocker never counts as stopping it',()=>{
    expect(classifyBlockers(['terrainPoi/water: five automated resolution strategies exhausted']))
      .toEqual(expect.objectContaining({line:[],directions:[],waivable:1}));
  });

  test('a trail with no blockers is clean',()=>{
    expect(classifyBlockers(undefined)).toEqual({total:0,line:[],directions:[],waivable:0});
  });
});

describe('how far along a trail is',()=>{
  test('the stages run in the order a trail travels',()=>{
    expect(STAGES[0]).toBe('geometry-audit');
    expect(STAGES.at(-1)).toBe('ready-for-editorial');
    expect(stageIndex('red-team')).toBeGreaterThan(stageIndex('evidence-research'));
  });

  test('a state that is not on the way has no distance',()=>{
    expect(stageIndex('rejected')).toBe(-1);
    expect(stageIndex('blocked')).toBe(-1);
  });

  test('the furthest trail comes first',()=>{
    const report=closestToVerified({trails:[
      trail('early','geometry-audit'),trail('late','red-team'),trail('middle','evidence-resolution')]});
    expect(report.nearest.map(r=>r.trailId)).toEqual(['late','middle','early']);
  });

  test('at the same stage, the one with less in its way comes first',()=>{
    const report=closestToVerified({trails:[
      trail('held','red-team',['not-closed-loop']),trail('clean','red-team',[])]});
    expect(report.nearest.map(r=>r.trailId)).toEqual(['clean','held']);
  });

  test('a parked trail is reported but never ranked',()=>{
    const report=closestToVerified({trails:[trail('gone','rejected',['not-closed-loop']),trail('live','red-team')]});
    expect(report.nearest.map(r=>r.trailId)).toEqual(['live']);
    expect(report.parked).toBe(1);
    expect(report.parkedBy).toEqual([{state:'rejected',trails:1}]);
  });
});

describe('how many directions are settled',()=>{
  const ledger={
    a:{claimId:'recommended-start',state:'supported'},
    b:{claimId:'route-number-status',state:'supported'},
    c:{claimId:'route-number-sequence',state:'researchable'},
    d:{claimId:'route-number-switches',state:'source-exhausted'},
    e:{claimId:'water',state:'supported'},
  };

  test('only the four directions are counted, not every claim',()=>{
    expect(directionsSettled({claimResolution:ledger}))
      .toEqual({settled:2,exhausted:1,researching:1,known:4});
  });

  test('a trail with no ledger reports nothing known rather than zero settled',()=>{
    expect(directionsSettled({}).known).toBe(0);
  });
});

describe('what the reader is told it is waiting on',()=>{
  test('a line fault is named first, because nothing else matters until it clears',()=>{
    expect(waiting({blockers:{line:['not-closed-loop'],directions:['logistics/recommended-start'],waivable:3},
      directions:{settled:0,known:4}})).toContain('the line: not-closed-loop');
  });

  test('directions are named without their agent prefix',()=>{
    expect(waiting({blockers:{line:[],directions:['logistics/route-number-switches'],waivable:0},
      directions:{settled:3,known:4}})).toBe('directions: route-number-switches');
  });

  test('a trail with nothing standing says so',()=>{
    expect(waiting({blockers:{line:[],directions:[],waivable:0},directions:{settled:0,known:0}}))
      .toContain('nothing standing');
  });
});
