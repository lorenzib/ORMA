'use strict';

const {routeGuidanceFromMap,sequenceValue,switchesValue,READ_FROM_MAP,MAP_AUTHORITY}
  =require('./workflows/route-guidance-from-map');
const {supportedRouteGuidance,citableRelations,MAP_ANSWERABLE_CLAIMS,ROUTE_GUIDANCE_CLAIM_IDS,
  routeGuidanceBlockingReasons}=require('./workflows/compile-verified-dossier');

const RELATIONS=[{externalRelationId:'relation/1484751',ref:'101'},
  {externalRelationId:'relation/6678431',ref:'105'}];
const GUIDANCE={sequence:['101','105'],
  switches:[{from:'101',to:'105',km:4.23,landmark:'Rifugio Locatelli'}]};

const cartographer=routeGuidance=>({agentId:'cartographer',
  result:{routeGuidance,source:{relations:RELATIONS}}});
const logisticsClaim=(id,over={})=>({agentId:'logistics',result:{claims:[{
  id,finding:'supported-proposal',proposedValue:'Start at Rifugio Auronzo and follow 101.',
  sources:[{label:'Operator',url:'https://example.test/route',authority:'Consorzio'}],...over}]}});

describe('the numbers read off the map',()=>{
  test('the order is written as what the map shows, not as an instruction',()=>{
    const value=sequenceValue(['101','105']);
    expect(value).toContain('The mapped route follows');
    // "Follow 101" would read as a recommendation; a relation recommends nothing.
    expect(value).not.toMatch(/^Follow /);
    expect(value).toContain(READ_FROM_MAP);
  });

  test('a walk that never changes number says so, rather than saying nothing',()=>{
    const value=switchesValue([],['101']);
    expect(value).toContain('no change of number recorded');
    expect(value).toContain(READ_FROM_MAP);
  });

  test('a change carries where it happens and what is there',()=>{
    const value=switchesValue(GUIDANCE.switches,GUIDANCE.sequence);
    expect(value).toContain('route 101 gives way to route 105');
    expect(value).toContain('4.2 km from the start');
    expect(value).toContain('near Rifugio Locatelli');
  });

  test('every value carries its own provenance, because values travel',()=>{
    const claims=routeGuidanceFromMap(GUIDANCE,RELATIONS);
    for(const claim of Object.values(claims)){
      expect(claim.proposedValue).toContain('Read from the OpenStreetMap route relations');
      expect(claim.derivedFrom).toBe('route-relations');
    }
  });

  test('the relation itself is the citation',()=>{
    const [source]=routeGuidanceFromMap(GUIDANCE,RELATIONS)['route-number-sequence'].sources;
    expect(source.url).toBe('https://www.openstreetmap.org/relation/1484751');
    expect(source.authority).toBe(MAP_AUTHORITY);
  });

  test('no citable relation means no claim, never a value with nothing behind it',()=>{
    expect(routeGuidanceFromMap(GUIDANCE,[])).toEqual({});
    expect(routeGuidanceFromMap(GUIDANCE,[{externalRelationId:'composite/tre-cime'}])).toEqual({});
  });
});

describe('what the map may and may not answer',()=>{
  test('it answers the order and the turns',()=>{
    const review={specialistOutputs:[cartographer(GUIDANCE)]};
    for(const id of MAP_ANSWERABLE_CLAIMS){
      expect(supportedRouteGuidance(review,id)).toBeTruthy();
    }
  });

  test('it never answers where to start or how the route is navigated',()=>{
    const review={specialistOutputs:[cartographer(GUIDANCE)]};
    const mapCannot=ROUTE_GUIDANCE_CLAIM_IDS.filter(id=>!MAP_ANSWERABLE_CLAIMS.includes(id));
    // A relation does not publish a start point, and cannot say whether a walk
    // is followed by numbers or by landmarks.
    expect(mapCannot).toEqual(['recommended-start','route-number-status']);
    for(const id of mapCannot) expect(supportedRouteGuidance(review,id)).toBeNull();
    // So those two still block.
    expect(routeGuidanceBlockingReasons(review.specialistOutputs).map(reason=>reason.split(':')[0]))
      .toEqual(mapCannot.map(id=>`logistics/${id}`));
  });

  test('an authority the agent cited wins over the measurement',()=>{
    const id='route-number-sequence';
    const review={specialistOutputs:[cartographer(GUIDANCE),logisticsClaim(id)]};
    const answer=supportedRouteGuidance(review,id);
    expect(answer.claim.sources[0].authority).toBe('Consorzio');
    expect(answer.claim.proposedValue).not.toContain('mapped route');
  });

  test('without a measurement the map answers nothing',()=>{
    const review={specialistOutputs:[cartographer(undefined)]};
    for(const id of MAP_ANSWERABLE_CLAIMS) expect(supportedRouteGuidance(review,id)).toBeNull();
  });
});

// 150 of 162 trails are built from a single relation rather than a composite,
// and 134 of those are imported. Reading only the composite's relation list
// left every one of them unable to cite the map it came from, so the easiest
// answer in the catalogue -- one relation is one number, from end to end --
// was the one not being given.
describe('a walk built from one relation',()=>{
  const single=(ref,externalId='relation/14381570')=>({agentId:'cartographer',result:{
    routeGuidance:{sequence:[String(ref)],switches:[],segments:[]},
    relation:{tags:{ref:String(ref)}},
    source:{externalId}}});

  test('the relation cites itself',()=>{
    expect(citableRelations(single('14').result))
      .toEqual([{externalRelationId:'relation/14381570',ref:'14'}]);
  });

  test('both claims are answered, and the turns claim says there are none',()=>{
    const review={specialistOutputs:[single('14')]};
    const sequence=supportedRouteGuidance(review,'route-number-sequence');
    const switches=supportedRouteGuidance(review,'route-number-switches');
    // One number has no order to be in.
    expect(sequence.proposedValue).toContain('route 14 from end to end');
    expect(sequence.proposedValue).not.toContain('in that order');
    // "This walk never changes path" is a complete answer, not a missing one.
    expect(switches.proposedValue).toContain('stays on route 14 throughout');
    expect(switches.proposedValue).toContain('no change of number recorded');
  });

  test('a relation with no number on it answers nothing',()=>{
    const unnumbered={agentId:'cartographer',result:{
      routeGuidance:{sequence:[],switches:[],segments:[]},
      relation:{tags:{}},source:{externalId:'relation/99'}}};
    const review={specialistOutputs:[unnumbered]};
    for(const id of MAP_ANSWERABLE_CLAIMS) expect(supportedRouteGuidance(review,id)).toBeNull();
  });

  test('a composite still cites all the routes it runs along',()=>{
    expect(citableRelations({source:{relations:RELATIONS},relation:{tags:{ref:'x'}}}))
      .toEqual(RELATIONS);
  });
});
