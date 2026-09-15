'use strict';

const {applyRouteNumberEvidence,officialRoutePage}=require('./scripts/route-number-evidence');
const planner=require('./backoffice/workflows/plan-catalogue-campaign');

const evidence=(extra={})=>new Map([['900',{ref:null,name:'Rundweg Laugen Elvas',
  url:'https://hiking.waymarkedtrails.org/#route?id=900',...extra}]]);
const trail=()=>({id:'osm-900',osmRelation:900});

describe('a route with no number is not a route with no identity',()=>{
  test('an official page is used as the cited source',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',
      evidence({website:{url:'https://www.bzgeisacktal.it/de/Rundweg_Laugen_Elvas_1',host:'bzgeisacktal.it'}}));
    expect(result.routeNumberStatus).toBe('official-route-page');
    expect(result.routeNumberSource).toEqual({provider:'bzgeisacktal.it',
      name:'Rundweg Laugen Elvas',url:'https://www.bzgeisacktal.it/de/Rundweg_Laugen_Elvas_1'});
  });

  test('a number still outranks a page',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',
      evidence({ref:'50',website:{url:'https://example.org/route',host:'example.org'}}));
    expect(result.routeNumberStatus).toBe('mapped-relation-ref');
    expect(result.routeRefs).toEqual(['50']);
  });

  test('no number and no page is still a finding, not a gap',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',evidence());
    expect(result.routeNumberStatus).toBe('not-listed-in-mapped-source');
  });

  // The gate refuses a source that is not https, so collecting one would only
  // produce a lead that cannot be cited.
  test('only https counts as an official page',()=>{
    expect(officialRoutePage('http://www.example.org/route')).toBeNull();
    expect(officialRoutePage('')).toBeNull();
    expect(officialRoutePage(null)).toBeNull();
    expect(officialRoutePage('not a url')).toBeNull();
    expect(officialRoutePage('https://www.example.org/route'))
      .toEqual({url:'https://www.example.org/route',host:'example.org'});
  });
});

describe('where an official page ranks',()=>{
  // Nobody has read the page yet, so this is not proof the gate can be cleared.
  // But it is much better than nobody having looked, which is what unknown means.
  test('above unknown, below proven, above unobtainable',()=>{
    expect(planner.routeGuidanceOutlook({routeNumberStatus:'official-route-page'})).toBe('sourced');
    expect(planner.GATE_SOURCED_WEIGHT).toBeLessThan(planner.GATE_CLEARABLE_WEIGHT);
    expect(planner.GATE_SOURCED_WEIGHT).toBeGreaterThan(planner.GATE_UNKNOWN_WEIGHT);
  });

  test('the tiers it sits between are unchanged',()=>{
    expect(planner.routeGuidanceOutlook({routeNumberStatus:'mapped-relation-ref'})).toBe('clearable');
    expect(planner.routeGuidanceOutlook({routeNumberStatus:'verification-pending'})).toBe('unknown');
    expect(planner.routeGuidanceOutlook({routeNumberStatus:'not-listed-in-mapped-source'})).toBe('unobtainable');
    expect(planner.routeGuidanceOutlook({})).toBe('unknown');
  });
});
