'use strict';

const {candidateFromProductionTrail}=require('./workflows/run-catalogue-batch');
const {runCartographer}=require('./workflows/run-cartographer');

// A composite recorded the numbers it measured and nothing at all otherwise, so
// a composite whose routes carry no number could not be told from one surveyed
// before the marks existed. From the gate those read alike, and only one of them
// is a walk to research.
//
// Cinque Torri was the last trail in the catalogue blocked on route guidance on
// 16 October 2026, for exactly that reason. Twelve trails are on this path --
// Tre Cime and Lago di Braies among them.

// [lat, lng] -- the order the site stores paths in.
const path=Array.from({length:30},(_,index)=>[46.54+Math.sin(index/5)*0.01,11.62+index*0.0008]);
const trail=()=>({id:'alpe-siusi',name:'Alpe di Siusi Meadow Loop',distance:9.2,path});

/** An approved composite whose member routes carry `refs`, or none. */
const composite=refs=>({state:'approved',trailName:'Alpe di Siusi Meadow Loop',
  coveragePercent:100,radiusMetres:60,approvedAt:'2026-09-06T09:59:37.348Z',
  relations:refs.map((ref,index)=>({externalRelationId:`relation/${9437572+index}`,
    ref,name:null,coveragePercent:46,firstCoveredIndex:index*3}))});

/**
 * What Overpass returns for the corridor: one relation per `ref`, each carrying
 * its own share of the walk.
 *
 * Split into shares on purpose. The composite search takes the smallest set of
 * routes that explains the walk, so two routes both covering all of it would
 * measure as one -- which is correct, and would have made this fixture assert
 * the wrong thing about a sequence.
 */
const covering=refs=>{
  const share=Math.ceil(path.length/Math.max(refs.length,1));
  const tagsFor=ref=>ref?{ref,route:'hiking',type:'route'}:{route:'hiking',type:'route'};
  return {elements:refs.flatMap((ref,index)=>{
    // Overlapping by a point so the walk stays explained end to end.
    const slice=path.slice(index*share,Math.min((index+1)*share+1,path.length));
    return [
      {type:'way',id:100+index,geometry:slice.map(([lat,lon])=>({lat,lon}))},
      {type:'relation',id:9437572+index,tags:tagsFor(ref),members:[{type:'way',ref:100+index}]},
    ];
  })};
};

const survey=(compositeRefs,corridor)=>runCartographer(
  candidateFromProductionTrail(trail(),{'alpe-siusi':composite(compositeRefs)}),
  {referenceMetrics:{distanceKm:null}},
  {fetchRoutesNearPath:corridor,at:'2026-10-16T12:00:00Z'});

describe('a composite survey says which of the three cases it is',()=>{
  test('numbered member routes are measured and recorded, as before',async()=>{
    const result=await survey(['30','7'],async()=>({payload:covering(['30','7'])}));
    expect(result.routeGuidance.sequence).toEqual(['30','7']);
    expect(result.routeNumbersAbsent).toBeUndefined();
    expect(result.routeNumbersUnmeasured).toBeUndefined();
  });

  test('a composite measures the numbered routes covering the walk itself',async()=>{
    // Its own measurement already works out which numbered routes carry each
    // stretch, whatever the approved members were recorded as -- a composite is
    // defined by the routes it runs along, so those are its own numbers and the
    // value rightly says the mapped route follows them.
    const result=await survey([null,null],async()=>({payload:covering(['23','25'])}));
    expect(result.routeGuidance.sequence).toEqual(['23','25']);
    expect(result.routeGuidance.alongOtherRoutes).toBeUndefined();
    expect(result.routeNumbersAbsent).toBeUndefined();
  });

  test('nothing numbered anywhere says so, which is a fact about the walk',async()=>{
    const result=await survey([null,null],async()=>({payload:covering([null])}));
    expect(result.routeNumbersAbsent).toBe(true);
    expect(result.routeGuidance).toBeUndefined();
    expect(result.routeNumbersUnmeasured).toBeUndefined();
  });

  test('a corridor query that fails says that instead, and carries why',async()=>{
    const result=await survey([null,null],async()=>{throw new Error('Overpass 504');});
    expect(result.routeNumbersUnmeasured).toContain('Overpass 504');
    expect(result.routeNumbersAbsent).toBeUndefined();
    // An outage is still not evidence about the trail.
    expect(result.blockers).not.toContain('composite-coverage-dropped');
  });

  test('every outcome is marked, so none reads as a survey too old to say',async()=>{
    const cases=[
      await survey(['30'],async()=>({payload:covering(['30'])})),
      await survey([null],async()=>({payload:covering(['23'])})),
      await survey([null],async()=>({payload:covering([null])})),
      await survey([null],async()=>{throw new Error('Overpass 504');}),
    ];
    for(const result of cases){
      const marked=Boolean(result.routeGuidance)||result.routeNumbersAbsent===true
        ||Boolean(result.routeNumbersUnmeasured);
      expect(marked).toBe(true);
    }
  });
});
