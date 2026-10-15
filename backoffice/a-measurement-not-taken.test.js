'use strict';

const {runCartographer}=require('./workflows/run-cartographer');
const {buildCandidate}=require('./workflows/discover-trails');
const {verdictOf}=require('./cli/dry-run-gate');

// La Croix des Salles was surveyed on 15 October 2026 and came back with no
// number measurement at all, because the Overpass corridor query fails for that
// trail. Nothing recorded that a measurement had been attempted and could not be
// taken, so the trail simply sat with its two route claims unanswered -- reading
// exactly like a walk nobody can supply directions for, when what it was short
// of was a request that reached the map.
//
// Three outcomes, not two: found numbers, looked and found none, or could not
// look. The third must never read as the second.

const WAYS=[
  {type:'way',id:10,geometry:[{lon:6.59,lat:45.87},{lon:6.60,lat:45.88}]},
  {type:'way',id:11,geometry:[{lon:6.60,lat:45.88},{lon:6.61,lat:45.87}]},
  {type:'way',id:12,geometry:[{lon:6.61,lat:45.87},{lon:6.59,lat:45.87}]},
];

async function survey(ref,fetchRoutesNearPath){
  const candidate=buildCandidate({id:'relation/11517208',name:'La Croix des Salles',
    geometry:[[6.59,45.87],[6.60,45.88],[6.61,45.87],[6.59,45.87]]},{at:'2026-10-16T09:00:00.000Z'});
  candidate.source.externalId='relation/11517208';
  return runCartographer(candidate,{referenceMetrics:{distanceKm:null}},{
    at:'2026-10-16T09:00:00.000Z',fetchRoutesNearPath,
    fetchRelation:async()=>({endpoint:'fixture',payload:{elements:[
      {type:'relation',id:11517208,version:2,timestamp:'2026-09-01T08:00:00Z',
        tags:{type:'route',route:'hiking',name:'La Croix des Salles',...(ref?{ref}:{})},
        members:WAYS.map(way=>({type:'way',ref:way.id}))},
      ...WAYS]}}),
  });
}

const empty=async()=>({payload:{elements:[]}});
const refuses=async()=>{ throw new Error('Unable to look for route relations: fetch failed'); };

describe('a measurement that could not be taken says so',()=>{
  test('a corridor query that fails is recorded, with what went wrong',async()=>{
    const result=await survey(null,refuses);
    expect(result.routeNumbersUnmeasured).toContain('fetch failed');
    // And never mistaken for having looked.
    expect(result.routeNumbersAbsent).toBeUndefined();
    expect(result.routeGuidance).toBeUndefined();
  });

  test('looking and finding none is the other answer, and stays distinct',async()=>{
    const result=await survey(null,empty);
    expect(result.routeNumbersAbsent).toBe(true);
    expect(result.routeNumbersUnmeasured).toBeUndefined();
  });

  test('a walk with its own number needed no corridor query, so nothing was missed',async()=>{
    const result=await survey('9',refuses);
    expect(result.routeGuidance).toEqual({sequence:['9'],switches:[],segments:[]});
    expect(result.routeNumbersUnmeasured).toBeUndefined();
    expect(result.routeNumbersAbsent).toBeUndefined();
  });

  test('the sweep calls it a survey to run again, not a refusal',()=>{
    const base={unwaivable:[],reportVersusDecision:[],contestedAnswers:[],
      wouldDecideWhenResearchEnds:'reject'};
    expect(verdictOf({...base,routeNumbersUnmeasured:'fetch failed',
      unwaivable:['logistics/route-number-sequence']}))
      .toBe('SURVEY AGAIN (the numbers were never measured)'
        +' + blocked by logistics/route-number-sequence');
    // A trail that was measured says nothing of the sort.
    expect(verdictOf({...base,unwaivable:['logistics/route-number-sequence']}))
      .toBe('blocked by logistics/route-number-sequence');
  });

  test('an approval still outranks it, because the verdict is what matters',()=>{
    expect(verdictOf({unwaivable:[],reportVersusDecision:[],contestedAnswers:[],
      routeNumbersUnmeasured:'fetch failed',wouldDecideWhenResearchEnds:'approve'}))
      .toBe('CAN be verified');
  });
});
