'use strict';

const {routeRefSegments,foldShortRuns,runsOf,refAtEachPoint,cumulativeMetres,MINIMUM_SEGMENT_METRES}
  =require('./workflows/route-ref-segments');

// Which numbered route a walker is on, at each point of the walk. The composite
// discovery already measures this and throws the per-point answer away, keeping
// only a coverage percentage -- so route-number-sequence and
// route-number-switches were sent to the web to be researched while the answer
// sat in the measurement that had just been taken.

// A line heading north-east, roughly 130 m between points at this latitude.
const line=count=>Array.from({length:count},(_,index)=>[46.6+index*0.001,12.3+index*0.001]);

describe('reading the numbers off the walk',()=>{
  test('a walk that never leaves one route has a sequence and no switch',()=>{
    const out=routeRefSegments(line(20),()=>['101']);
    expect(out.sequence).toEqual(['101']);
    expect(out.switches).toEqual([]);
    expect(out.segments).toHaveLength(1);
  });

  test('a change of route is one switch, placed where the walker leaves the old one',()=>{
    // 101 to index 8, both across the junction, 105 from index 12.
    const out=routeRefSegments(line(20),index=>index<9?['101']:index<12?['101','105']:['105']);
    expect(out.sequence).toEqual(['101','105']);
    expect(out.switches).toHaveLength(1);
    expect(out.switches[0]).toEqual(expect.objectContaining({from:'101',to:'105'}));
    // Held on 101 through the overlap: a walker stays on the trail they are on
    // until it stops going their way.
    expect(out.segments[0].toIndex).toBe(11);
    expect(out.switches[0].km).toBe(out.segments[1].fromKm);
  });

  test('two routes sharing a valley do not flip the walker back and forth',()=>{
    const out=routeRefSegments(line(30),index=>index<5?['7']:['7','30']);
    expect(out.sequence).toEqual(['7']);
    expect(out.switches).toEqual([]);
  });

  test('a brush past a route it never joins is not a switch',()=>{
    // A stretch shorter than a walker could notice, on a finely drawn line.
    const fine=Array.from({length:60},(_,index)=>[46.6+index*0.0002,12.3]);
    const metres=cumulativeMetres(fine);
    expect(metres[32]-metres[30]).toBeLessThan(MINIMUM_SEGMENT_METRES);
    const out=routeRefSegments(fine,index=>(index>=30&&index<33)?['105']:['101']);
    expect(out.sequence).toEqual(['101']);
    expect(out.switches).toEqual([]);
  });

  test('the same brush on a coarsely drawn line is still not a switch',()=>{
    // Point counts say nothing: a hand-traced walk and a GPS track of the same
    // ground differ by an order of magnitude, so the rule is in metres.
    const coarse=[[46.6,12.3],[46.6005,12.3],[46.6006,12.3],[46.6007,12.3],[46.602,12.3],[46.604,12.3]];
    const out=routeRefSegments(coarse,index=>(index>=1&&index<=3)?['105']:['101']);
    expect(out.sequence).toEqual(['101']);
  });

  test('an unnumbered stretch is recorded, and is not a switch at either end',()=>{
    const out=routeRefSegments(line(30),index=>index<10?['101']:index<20?[]:['105']);
    expect(out.segments.map(segment=>segment.ref)).toEqual(['101',null,'105']);
    // "Leave 101 and follow nothing" is not an instruction.
    expect(out.switches).toEqual([]);
    // The sequence still says which numbers the walk uses.
    expect(out.sequence).toEqual(['101','105']);
  });

  test('a switch carries where it happens, so it can be read as a direction',()=>{
    const out=routeRefSegments(line(20),index=>index<10?['101']:['105']);
    const [change]=out.switches;
    expect(Number.isFinite(change.lat)&&Number.isFinite(change.lng)).toBe(true);
    expect(change.km).toBeGreaterThan(0);
    // Named by the landmark the caller knows about.
    const named=routeRefSegments(line(20),index=>index<10?['101']:['105'],
      {landmarkAt:km=>km>1?'Rifugio Locatelli':null});
    expect(named.switches[0].landmark).toBe('Rifugio Locatelli');
  });

  test('a walk too short to measure says nothing rather than guessing',()=>{
    expect(routeRefSegments([],()=>['101']).segments).toEqual([]);
    expect(routeRefSegments([[46,12]],()=>['101']).switches).toEqual([]);
  });

  test('the real shape: three routes in the order they are met',()=>{
    // Sassolungo's composite carries 557, SI and 526.
    const out=routeRefSegments(line(40),index=>index<13?['557']:index<26?['SI']:['526']);
    expect(out.sequence).toEqual(['557','SI','526']);
    expect(out.switches.map(change=>`${change.from}->${change.to}`))
      .toEqual(['557->SI','SI->526']);
  });

  test('folding never leaves two neighbours carrying the same number',()=>{
    const runs=runsOf(['101','101','101','101','105','101','101','101','101']);
    // Every point 10 m apart, so the single-point 105 run is far too short.
    const metres=runs.length?Array.from({length:9},(_,index)=>index*10):[];
    expect(foldShortRuns(runs,metres).map(run=>run.ref)).toEqual(['101']);
  });

  test('without distances nothing is folded, rather than folded on a guess',()=>{
    const runs=runsOf(['101','105','101']);
    expect(foldShortRuns(runs).map(run=>run.ref)).toEqual(['101','105','101']);
  });

  test('the point assignment holds the current route where several are in range',()=>{
    expect(refAtEachPoint(4,index=>index===0?['101']:['105','101'])).toEqual(['101','101','101','101']);
  });
});
