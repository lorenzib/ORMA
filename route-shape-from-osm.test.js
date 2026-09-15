'use strict';

const {assessGeometry,isCircularRoute}=require('./backoffice/services/geometry-validator');
const {reconstructRelation,roundtripFromTags}=require('./backoffice/services/relation-geometry');

// An open line: ends nowhere near where it started.
const openRoute=[[11.80,46.50],[11.81,46.50],[11.82,46.51],[11.83,46.52]];

describe('OSM answers the question the geometry cannot',()=>{
  test('a route the mapper tagged as not circular is no longer faulted for not closing',()=>{
    expect(assessGeometry(openRoute).issues).toContain('not-closed-loop');
    expect(assessGeometry(openRoute,{roundtrip:false}).issues).not.toContain('not-closed-loop');
  });

  test('a route tagged circular is still held to closing',()=>{
    expect(assessGeometry(openRoute,{roundtrip:true}).issues).toContain('not-closed-loop');
  });

  // Anello dei Forti, Ciampeviei and Troi de le Ciaure are all roundtrip=yes and
  // all miss closure — 123 m, 438 m, 590 m. The tag confirms the check applies to
  // them; it does not excuse them, and it should not.
  test('the reported circularity says whether the test was applied',()=>{
    expect(assessGeometry(openRoute,{roundtrip:false}).circular).toBe(false);
    expect(assessGeometry(openRoute,{roundtrip:true}).circular).toBe(true);
    expect(assessGeometry(openRoute).circular).toBe(true);
  });

  test('a human declaration outranks the tag, in both directions',()=>{
    // A relation mis-tagged as circular, corrected by a moderator.
    expect(isCircularRoute({routeShape:'out-and-back',roundtrip:true})).toBe(false);
    // ...and the reverse.
    expect(isCircularRoute({routeShape:'loop',roundtrip:false})).toBe(true);
  });

  test('anything but an explicit yes or no is no answer, and nothing changes',()=>{
    for(const value of [undefined,null,'','maybe',0,1]){
      expect(isCircularRoute({roundtrip:value})).toBe(true);
    }
  });

  test('routeShape still reports the declared shape, or the default',()=>{
    expect(assessGeometry(openRoute,{roundtrip:false}).routeShape).toBe('loop');
    expect(assessGeometry(openRoute,{routeShape:'point-to-point'}).routeShape).toBe('point-to-point');
  });
});

describe('reading the tag off a relation',()=>{
  test('only yes and no are answers',()=>{
    expect(roundtripFromTags({roundtrip:'yes'})).toBe(true);
    expect(roundtripFromTags({roundtrip:'YES'})).toBe(true);
    expect(roundtripFromTags({roundtrip:'no'})).toBe(false);
    expect(roundtripFromTags({roundtrip:'unknown'})).toBeNull();
    expect(roundtripFromTags({})).toBeNull();
    expect(roundtripFromTags(null)).toBeNull();
  });

  test('a relation tagged roundtrip=no reconstructs without the closure fault',()=>{
    const ways=[{id:1,coordinates:openRoute}];
    const payload={elements:[
      {type:'relation',id:7,tags:{type:'route',route:'hiking',roundtrip:'no'},
        members:[{type:'way',ref:1}]},
      {type:'way',id:1,nodes:openRoute.map((_,i)=>100+i)},
      ...openRoute.map((c,i)=>({type:'node',id:100+i,lon:c[0],lat:c[1]})),
    ]};
    const result=reconstructRelation(payload,'relation/7',{});
    expect(result.assessment.issues).not.toContain('not-closed-loop');
    expect(result.assessment.circular).toBe(false);
  });

  test('the same relation without the tag keeps the old assumption',()=>{
    const payload={elements:[
      {type:'relation',id:8,tags:{type:'route',route:'hiking'},members:[{type:'way',ref:1}]},
      {type:'way',id:1,nodes:openRoute.map((_,i)=>200+i)},
      ...openRoute.map((c,i)=>({type:'node',id:200+i,lon:c[0],lat:c[1]})),
    ]};
    expect(reconstructRelation(payload,'relation/8',{}).assessment.issues).toContain('not-closed-loop');
  });
});
