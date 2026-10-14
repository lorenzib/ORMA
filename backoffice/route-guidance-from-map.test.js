'use strict';

const {routeGuidanceFromMap,sequenceValue,switchesValue,READ_FROM_MAP,MAP_AUTHORITY}
  =require('./workflows/route-guidance-from-map');
const {supportedRouteGuidance,MAP_ANSWERABLE_CLAIMS,ROUTE_GUIDANCE_CLAIM_IDS,
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
