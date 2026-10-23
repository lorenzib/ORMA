const { applyVerifiedTrailOverrides } = require('./scripts/verified-trail-overrides');

describe('verified trail overrides', () => {
  test('accepts scoped route-reference evidence without marking the whole trail verified', () => {
    const [trail] = applyVerifiedTrailOverrides([{ id:'trail-a', curated:false }], {
      trails:[{
        id:'trail-a',
        verificationScope:'routeRefs',
        fields:{ routeRefSegments:[{ ref:'15A', path:[[46.64, 11.92], [46.63, 11.92]] }] },
      }],
    });

    expect(trail.ormaVerified).not.toBe(true);
    expect(trail.routeRefSegments[0].ref).toBe('15A');
  });

  test('rejects an unscoped partial override', () => {
    expect(() => applyVerifiedTrailOverrides([{ id:'trail-a' }], {
      trails:[{ id:'trail-a', fields:{ routeRefs:['15A'] } }],
    })).toThrow(/full-trail, route-reference, route-guidance, route-reviewed, route-shape, start-point or route-line verification/);
  });

  test('accepts scoped landmark guidance without marking the whole trail verified', () => {
    const [trail] = applyVerifiedTrailOverrides([{ id:'trail-a', curated:false }], {
      trails:[{
        id:'trail-a',verificationScope:'routeGuidance',fields:{routeNumberStatus:'official-landmark-route',routeNumberGuidance:{
          mode:'landmarks',start:'Start at the village square.',sequence:'Cross the fields, then follow the river.',
          switches:'At the bridge, turn right to return.',sources:[{label:'Official guide',url:'https://example.test/route',reviewedAt:'2026-09-04'}],
        }},
      }],
    });

    expect(trail.ormaVerified).not.toBe(true);
    expect(trail.routeNumberGuidance).toEqual(expect.objectContaining({mode:'landmarks'}));
  });

  test('accepts a scoped start point with sources without marking the whole trail verified', () => {
    const [trail] = applyVerifiedTrailOverrides([{ id:'trail-a', curated:false, startPoint:{ lat:1, lng:1, label:'Lift station' } }], {
      trails:[{
        id:'trail-a', verificationScope:'startPoint',
        sources:[{ label:'OpenStreetMap', url:'https://www.openstreetmap.org/#map=18/46.52/11.87', reviewedAt:'2026-10-06' }],
        fields:{ startPoint:{ lat:46.52004, lng:11.87393, label:'Passo Campolongo, parking beside the Cherz I base' } },
      }],
    });
    expect(trail.ormaVerified).not.toBe(true);
    expect(trail.curated).toBe(false);
    expect(trail.startPoint).toEqual({ lat:46.52004, lng:11.87393, label:'Passo Campolongo, parking beside the Cherz I base' });
  });

  test('replaces an imported line with a sourced official line and nothing else', () => {
    const line = [[46.54204, 10.99034], [46.53658, 10.99066], [46.54204, 10.99034]];
    const [trail] = applyVerifiedTrailOverrides([{ id:'osm-1', curated:false, path:[[1, 1], [2, 2]], distance:11.7 }], {
      trails:[{
        id:'osm-1', verificationScope:'routeLine',
        sources:[{ label:'Official page and GPX', url:'https://example.test/walk', reviewedAt:'2026-10-23' }],
        fields:{ path:line, distance:7.7, routeLineNote:'Rebuilt on OSM ways along the official GPX.' },
      }],
    });
    expect(trail.path).toEqual(line);
    expect(trail.distance).toBe(7.7);
    expect(trail.ormaVerified).not.toBe(true);
    expect(trail.curated).toBe(false);
  });

  test('rejects a route line without a note, without a source, or carrying other fields', () => {
    const fields = { path:[[1, 1], [2, 2]], distance:3, routeLineNote:'Rebuilt.' };
    const sources = [{ url:'https://x.test', reviewedAt:'2026-10-23' }];
    expect(() => applyVerifiedTrailOverrides([{ id:'a' }], { trails:[{ id:'a', verificationScope:'routeLine', sources, fields:{ ...fields, routeLineNote:'' } }] })).toThrow(/route-line verification/);
    expect(() => applyVerifiedTrailOverrides([{ id:'a' }], { trails:[{ id:'a', verificationScope:'routeLine', fields }] })).toThrow(/route-line verification/);
    expect(() => applyVerifiedTrailOverrides([{ id:'a' }], { trails:[{ id:'a', verificationScope:'routeLine', sources, fields:{ ...fields, ormaVerified:true } }] })).toThrow(/route-line verification/);
  });

  test('rejects a start point without a label or without a source', () => {
    expect(() => applyVerifiedTrailOverrides([{ id:'trail-a' }], {
      trails:[{ id:'trail-a', verificationScope:'startPoint', sources:[{ url:'https://x.test', reviewedAt:'2026-10-06' }], fields:{ startPoint:{ lat:1, lng:2 } } }],
    })).toThrow(/start-point/);
    expect(() => applyVerifiedTrailOverrides([{ id:'trail-a' }], {
      trails:[{ id:'trail-a', verificationScope:'startPoint', fields:{ startPoint:{ lat:1, lng:2, label:'Somewhere' } } }],
    })).toThrow(/start-point/);
  });

  // A walk whose directions came from the map, or from ORMA's own record, has
  // no operator's page to cite and never will. Requiring a dated external
  // source of every scoped entry would exclude exactly those walks -- which is
  // most of the catalogue. What it may not do is cite nothing and say nothing
  // about why, so the rung each answer came from has to be named.
  const GUIDANCE = Object.freeze({mode:'numbered',start:'Start at the car park.',
    status:'The mapped route carries trail number 20.',sequence:'Follows route 20 end to end.',
    switches:'Stays on route 20 throughout.'});
  const OSM_SOURCE = Object.freeze([{label:'OpenStreetMap relation 11839597',
    url:'https://www.openstreetmap.org/relation/11839597',accessedAt:'2026-09-01T00:00:00Z'}]);
  const RUNGS = (start,status,sequence,switches) => ({start,status,sequence,switches});
  const scoped = (scope,fields) => ({trails:[{id:'trail-a',verificationScope:scope,fields}]});
  const apply = artifact => applyVerifiedTrailOverrides([{id:'trail-a',curated:false}],artifact);

  test('takes a map answer dated by the relation it was read from', () => {
    const [trail] = apply(scoped('routeGuidance',{routeNumberGuidance:{...GUIDANCE,
      establishedBy:RUNGS('route-relations','route-relations','route-relations','route-relations'),
      sources:OSM_SOURCE}}));
    expect(trail.routeNumberGuidance.sources[0].accessedAt).toBe('2026-09-01T00:00:00Z');
  });

  test("takes an answer that is entirely ORMA's own record, citing nothing outside", () => {
    const [trail] = apply(scoped('routeGuidance',{routeNumberGuidance:{...GUIDANCE,
      establishedBy:RUNGS('orma-record','orma-record','orma-record','orma-record'),sources:[]}}));
    expect(trail.routeNumberGuidance.start).toBe(GUIDANCE.start);
  });

  test('refuses an answer that rests on the map and cites nothing', () => {
    expect(() => apply(scoped('routeGuidance',{routeNumberGuidance:{...GUIDANCE,
      establishedBy:RUNGS('orma-record','orma-record','route-relations','route-relations'),sources:[]}})))
      .toThrow(/route-guidance/);
  });

  test('refuses a rung it does not recognise', () => {
    expect(() => apply(scoped('routeGuidance',{routeNumberGuidance:{...GUIDANCE,
      establishedBy:RUNGS('somebody-said-so','orma-record','orma-record','orma-record'),sources:[]}})))
      .toThrow(/route-guidance/);
  });

  test('a reviewed publication states what it is short of', () => {
    const required=['photo','route','routeNumbers','mapPoints','elevation',
      'water','heat','exposure','livestock','surfaceHazards','access'];
    const fields={ormaVerified:false,desc:'A gentle promenade.',
      routeNumberGuidance:{...GUIDANCE,
        establishedBy:RUNGS('orma-record','orma-record','route-relations','route-relations'),
        sources:OSM_SOURCE},
      graduation:{status:'in-progress',required,
        completed:['photo','route','routeNumbers','mapPoints','elevation']}};
    const [trail] = apply(scoped('routeReviewed',fields));
    expect(trail.ormaVerified).toBe(false);
    expect(trail.desc).toBe('A gentle promenade.');

    // Nothing to say what it is short of, and it is refused.
    const {graduation,...noGraduation}=fields;
    expect(() => apply(scoped('routeReviewed',noGraduation))).toThrow(/route-reviewed/);
    // Claiming the eleven through the reviewed door is refused too.
    expect(() => apply(scoped('routeReviewed',{...fields,
      graduation:{status:'in-progress',required,completed:required}}))).toThrow(/route-reviewed/);
  });

  test('the seal comes through one door only', () => {
    // `ormaVerified: true` used to be waved through whatever scope an entry
    // declared, so an entry could read as the narrow thing its label said while
    // granting the whole seal.
    expect(() => apply(scoped('routeReviewed',{ormaVerified:true}))).toThrow(/route-reviewed/);
    expect(() => apply(scoped('routeShape',{ormaVerified:true}))).toThrow(/route-shape/);
    const [trail] = applyVerifiedTrailOverrides([{id:'trail-a'}],
      {trails:[{id:'trail-a',fields:{ormaVerified:true}}]});
    expect(trail.ormaVerified).toBe(true);
  });
});
