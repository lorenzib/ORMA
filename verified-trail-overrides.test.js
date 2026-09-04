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
    })).toThrow(/full-trail, route-reference or route-guidance verification/);
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
});
