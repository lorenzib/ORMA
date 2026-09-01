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
    })).toThrow(/full-trail or route-reference verification/);
  });
});
