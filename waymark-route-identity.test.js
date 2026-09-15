'use strict';

const {applyRouteNumberEvidence,waymarkDescription}=require('./scripts/route-number-evidence');
const {routeGuidanceLeads}=require('./backoffice/workflows/run-trail-specialist');
const planner=require('./backoffice/workflows/plan-catalogue-campaign');

const evidence=(extra={})=>new Map([['900',{ref:null,name:'Anton Schwingshackl Weg',
  url:'https://hiking.waymarkedtrails.org/#route?id=900',...extra}]]);
const trail=()=>({id:'osm-900',osmRelation:900});
const waymark=v=>({waymark:waymarkDescription(v)});

describe('a signed route is identifiable even with no number and no page',()=>{
  test('the waymark becomes the identity',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',evidence(waymark('red:red:white_bar:AS:black')));
    expect(result.routeNumberStatus).toBe('waymarked-route');
    expect(result.routeWaymark.described).toBe('white bar on red, marked "AS"');
    expect(result.routeWaymark.osmc).toBe('red:red:white_bar:AS:black');
  });

  test('an official page still outranks a waymark',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',
      evidence({...waymark('red::white_dot'),website:{url:'https://example.org/r',host:'example.org'}}));
    expect(result.routeNumberStatus).toBe('official-route-page');
  });

  test('and a number outranks both',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',
      evidence({ref:'50',...waymark('red::white_dot'),website:{url:'https://example.org/r',host:'example.org'}}));
    expect(result.routeNumberStatus).toBe('mapped-relation-ref');
  });

  test('no waymark and no page is still a finding',()=>{
    const [result]=applyRouteNumberEvidence([trail()],'.',evidence());
    expect(result.routeNumberStatus).toBe('not-listed-in-mapped-source');
  });
});

describe('reading osmc:symbol',()=>{
  test.each([
    ['red:red:white_bar:AS:black','white bar on red, marked "AS"'],
    ['red::white_dot','white dot'],
    ['yellow:blue:yellow_bar','yellow bar on blue'],
    ['red:green_round::H:white','green circle, marked "H"'],
  ])('%s reads as %s',(osmc,described)=>{
    expect(waymarkDescription(osmc).described).toBe(described);
  });

  // An undecoded waymark is still evidence the route is signed, so it is kept
  // rather than dropped for not matching the scheme.
  test('a free-text waymark is kept verbatim',()=>{
    expect(waymarkDescription('Pfad weiß auf grün mit Sonne').described).toBe('Pfad weiß auf grün mit Sonne');
  });

  test('nothing recorded is null, not an empty description',()=>{
    expect(waymarkDescription('')).toBeNull();
    expect(waymarkDescription(null)).toBeNull();
  });
});

describe('the waymark reaches the agent',()=>{
  // It is not a citable source -- nobody publishes it -- so it travels as a
  // recorded fact about the route instead.
  test('as a recorded fact, in words',()=>{
    const leads=routeGuidanceLeads({id:'t',routeWaymark:{osmc:'red::white_dot',described:'white dot'}});
    expect(leads.recordedWaymark).toBe('white dot');
  });

  test('absent when the route carries none',()=>{
    expect(routeGuidanceLeads({id:'t'}).recordedWaymark).toBeNull();
  });
});

describe('where a waymarked route ranks',()=>{
  test('below an official page, above nobody having looked',()=>{
    expect(planner.routeGuidanceOutlook({routeNumberStatus:'waymarked-route'})).toBe('waymarked');
    expect(planner.GATE_WAYMARKED_WEIGHT).toBeLessThan(planner.GATE_SOURCED_WEIGHT);
    expect(planner.GATE_WAYMARKED_WEIGHT).toBeGreaterThan(planner.GATE_UNKNOWN_WEIGHT);
  });
});
