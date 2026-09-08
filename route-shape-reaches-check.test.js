const { runCartographer } = require('./backoffice/workflows/run-cartographer');
const { candidateFromProductionTrail } = require('./backoffice/workflows/run-catalogue-batch');
const { applyVerifiedTrailOverrides } = require('./scripts/verified-trail-overrides');

// route-shape.test.js proved the validator honours a declared shape, and that a
// declaration reaches the trail. Both ends passed while the middle was missing:
// nothing carried the shape from the trail to the check, so osm-10116283 was
// declared an out-and-back on 2026-09-08 and stayed faulted 'not-closed-loop'.
// This walks the whole chain, which is the only thing that would have caught it.

// An open route: starts in one place, ends in another.
const OPEN_WAY = {
  type:'way', id:1,
  nodes:[1,2,3],
  geometry:[{lat:46.500,lon:11.600},{lat:46.520,lon:11.620},{lat:46.540,lon:11.640}],
};
const RELATION = {
  elements:[
    {type:'relation',id:99,version:3,timestamp:'2026-01-01T00:00:00Z',
      tags:{type:'route',route:'hiking',name:'Itinéraire de découverte historique'},
      members:[{type:'way',ref:1,role:''}]},
    OPEN_WAY,
  ],
};

function trailDeclared(shape){
  const overrides = shape ? { trails:[{ id:'t1', verificationScope:'routeShape',
    fields:{ routeShape:shape, routeShapeNote:'Moderator review: this route is not a circuit.' } }] } : { trails:[] };
  const [trail] = applyVerifiedTrailOverrides(
    [{ id:'t1', name:'Itinéraire', distance:5.2, waymarkedtrails:null,
       osmRelation:99, source:'https://example.org' }],
    overrides);
  return trail;
}

async function audit(trail){
  return runCartographer(candidateFromProductionTrail(trail), { referenceMetrics:{ distanceKm:5.2 } },
    { fetchRelation: async () => ({ payload:RELATION, endpoint:'test', query:null }) });
}

describe('a declared route shape reaches the geometry check', () => {
  test('an undeclared open route is still faulted for not closing', async () => {
    const result = await audit(trailDeclared(null));
    expect(result.assessment.issues).toContain('not-closed-loop');
    expect(result.blockers).toContain('not-closed-loop');
    expect(result.reviewState).toBe('blocked');
  });

  test('a declared out-and-back is not faulted for failing to close', async () => {
    const result = await audit(trailDeclared('out-and-back'));
    expect(result.assessment.issues).not.toContain('not-closed-loop');
    expect(result.blockers).not.toContain('not-closed-loop');
    expect(result.assessment.routeShape).toBe('out-and-back');
  });

  test('a declared point-to-point is not faulted either', async () => {
    const result = await audit(trailDeclared('point-to-point'));
    expect(result.assessment.issues).not.toContain('not-closed-loop');
  });

  // The declaration must not become a way to wave a broken route through.
  test('declaring a shape does not clear anything else', async () => {
    const result = await audit(trailDeclared('out-and-back'));
    // The distance conflict is judged on its own terms, shape or no shape.
    expect(result.comparison.officialDistanceKm).toBe(5.2);
    expect(result.assessment.status).toBe('passed');
  });

  test('the candidate carries the shape the trail was given', () => {
    expect(candidateFromProductionTrail(trailDeclared('out-and-back')).routeShape).toBe('out-and-back');
    expect(candidateFromProductionTrail(trailDeclared(null)).routeShape).toBeNull();
  });
});
