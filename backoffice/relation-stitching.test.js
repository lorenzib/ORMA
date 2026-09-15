'use strict';

const {mergePieces,MERGE_TOLERANCE_M,stitchWays,reconstructRelation}=require('./services/relation-geometry');

// About 11 m per 0.0001 degree of latitude at this scale, which is the unit the
// gaps below are expressed in.
const M=0.0000090;
const piece=(id,points)=>({id,coordinates:points});
const line=(lat,lng,count,step=0.0005)=>Array.from({length:count},(_,i)=>[lng+i*step,lat]);

describe('member ways torn apart by a survey-grade gap',()=>{
  // Anello dei Colli is two pieces five metres apart. Assessed as the largest
  // fragment it measured 4.18 km against an official 5.3 and failed closure,
  // disconnected-components and distance — three blockers from one cause.
  test('a gap under the merge tolerance is rejoined',()=>{
    const a=piece('w1',line(46.5,11.8,4));
    const gapStart=a.coordinates[a.coordinates.length-1];
    const b=piece('w2',line(46.5+5*M,gapStart[0],4));
    const merged=mergePieces([{...a,wayIds:['w1']},{...b,wayIds:['w2']}],MERGE_TOLERANCE_M);
    expect(merged).toHaveLength(1);
    expect(merged[0].wayIds).toEqual(['w1','w2']);
  });

  test('a gap beyond it is left alone, because it is a real hole',()=>{
    const a=piece('w1',line(46.5,11.8,4));
    const far=piece('w2',line(46.5+600*M,11.9,4));
    const merged=mergePieces([{...a,wayIds:['w1']},{...far,wayIds:['w2']}],MERGE_TOLERANCE_M);
    expect(merged).toHaveLength(2);
  });

  // The property that makes the tolerance safe to choose at all.
  test('merging never produces more pieces than it was given',()=>{
    const pieces=[
      {...piece('w1',line(46.5,11.80,3)),wayIds:['w1']},
      {...piece('w2',line(46.6,11.90,3)),wayIds:['w2']},
      {...piece('w3',line(46.7,12.00,3)),wayIds:['w3']},
    ];
    for(const tolerance of [0,3,12,30,200,5000]){
      expect(mergePieces(pieces.map(p=>({...p,coordinates:p.coordinates.map(c=>c.slice())})),tolerance).length)
        .toBeLessThanOrEqual(pieces.length);
    }
  });

  test('a single piece is returned untouched',()=>{
    const only=[{...piece('w1',line(46.5,11.8,5)),wayIds:['w1']}];
    expect(mergePieces(only,MERGE_TOLERANCE_M)).toHaveLength(1);
  });
});

describe('attachment is deliberately left tight',()=>{
  // Raising the ATTACH tolerance is what broke a relation that stitched whole:
  // attachment is greedy and takes the first way within tolerance, so a looser
  // one lets a way bind to the wrong neighbour. The merge pass exists so the
  // tolerance never has to be loosened here.
  test('ways further apart than the attach tolerance still start as separate pieces',()=>{
    const first=piece('w1',line(46.5,11.8,3));
    const end=first.coordinates[first.coordinates.length-1];
    const second=piece('w2',line(46.5+8*M,end[0],3));
    expect(stitchWays([first,second],{toleranceM:3,mergeToleranceM:0})).toHaveLength(2);
    // ...and the merge pass is what puts them back together.
    expect(stitchWays([first,second],{toleranceM:3})).toHaveLength(1);
  });
});

describe('a relation reconstructed end to end',()=>{
  function payload(ways){
    return {elements:[
      {type:'relation',id:99,tags:{type:'route',route:'hiking'},
        members:ways.map(w=>({type:'way',ref:w.id}))},
      ...ways.map(w=>({type:'way',id:w.id,nodes:w.coordinates.map((_,i)=>w.id*100+i)})),
      ...ways.flatMap(w=>w.coordinates.map((c,i)=>({type:'node',id:w.id*100+i,lon:c[0],lat:c[1]}))),
    ]};
  }
  test('reports one component and the full length once a small gap is merged',()=>{
    const a=piece(1,line(46.5,11.8,5));
    const b=piece(2,line(46.5+6*M,a.coordinates[a.coordinates.length-1][0],5));
    const result=reconstructRelation(payload([a,b]),'relation/99',{});
    expect(result.assessment.issues).not.toContain('disconnected-components');
    expect(result.geometry.coordinates.length).toBe(9);
  });
});
