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
    })).toThrow(/full-trail, route-reference, route-guidance, route-shape or start-point verification/);
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

  test('rejects a start point without a label or without a source', () => {
    expect(() => applyVerifiedTrailOverrides([{ id:'trail-a' }], {
      trails:[{ id:'trail-a', verificationScope:'startPoint', sources:[{ url:'https://x.test', reviewedAt:'2026-10-06' }], fields:{ startPoint:{ lat:1, lng:2 } } }],
    })).toThrow(/start-point verification/);
    expect(() => applyVerifiedTrailOverrides([{ id:'trail-a' }], {
      trails:[{ id:'trail-a', verificationScope:'startPoint', fields:{ startPoint:{ lat:1, lng:2, label:'Somewhere' } } }],
    })).toThrow(/start-point verification/);
  });
});
