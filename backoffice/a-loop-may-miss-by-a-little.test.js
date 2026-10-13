'use strict';

const {closureToleranceM,assessGeometry,CLOSURE_FLOOR_M,CLOSURE_CEILING_M,
  CLOSURE_SHARE,distanceMeters}=require('./services/geometry-validator');

/**
 * "Boucle du Taillefer" was rejected for not-closed-loop: a declared loop, 6.71
 * km of line reconstructed from its relation, ends 101 metres apart against a
 * flat 100 m threshold. One metre over, on a route where 101 m is 1.5% of the
 * walk -- the resolution of the map data, not a route that fails to come back.
 */

// A ring of points at a given radius, opened by a gap at the end. Built rather
// than retyped so the line's length and its gap are both real measurements.
function ring(radiusM,gapM){
  const R=6371000, lat0=46.5, lng0=11.5;
  const dLat=radiusM/R*(180/Math.PI);
  const dLng=dLat/Math.cos(lat0*Math.PI/180);
  const points=[];
  const steps=720;
  const closeAt=2*Math.PI-(gapM/radiusM);
  for(let i=0;i<=steps;i+=1){
    const a=closeAt*(i/steps);
    points.push([lat0+dLat*Math.sin(a),lng0+dLng*Math.cos(a)]);
  }
  return points;
}

describe('how far a loop may miss by',()=>{
  test('a short loop keeps the strict floor',()=>{
    expect(closureToleranceM(400)).toBe(CLOSURE_FLOOR_M);
    expect(closureToleranceM(1000)).toBe(CLOSURE_FLOOR_M);
  });

  test('a longer loop is allowed a share of its own length',()=>{
    expect(Math.round(closureToleranceM(6710))).toBe(Math.round(6710*CLOSURE_SHARE));
    expect(closureToleranceM(6710)).toBeGreaterThan(101);
  });

  test('and no loop is allowed more than the ceiling',()=>{
    expect(closureToleranceM(18000)).toBe(CLOSURE_CEILING_M);
    expect(closureToleranceM(100000)).toBe(CLOSURE_CEILING_M);
  });

  test('a missing or absurd length falls back to the floor',()=>{
    for(const value of [0,-5,NaN,undefined,null]) expect(closureToleranceM(value)).toBe(CLOSURE_FLOOR_M);
  });
});

describe('what that means for a real line',()=>{
  const assess=points=>assessGeometry(points.map(([lat,lng])=>[lng,lat]),{routeShape:'loop'});

  test('a 6.7 km loop missing 101 m is closed now',()=>{
    const result=assess(ring(1068,101));
    expect(result.distanceKm).toBeGreaterThan(6);
    expect(result.isClosed).toBe(true);
    expect(result.issues).not.toContain('not-closed-loop');
  });

  // The same line under the old flat rule, to show this is the change and not
  // a difference in how the ring is built.
  test('the same line was not closed at a flat 100 m',()=>{
    const points=ring(1068,101).map(([lat,lng])=>[lng,lat]);
    expect(assessGeometry(points,{routeShape:'loop',closureThresholdM:100}).issues)
      .toContain('not-closed-loop');
  });

  // A gap wider than the floor on a sub-kilometre loop. Asserted against what
  // the check measured rather than the arc asked for: the chord between two
  // points on a small circle is shorter than the arc between them, so a nominal
  // gap is not the distance the check sees.
  test('a short loop missing more than the floor is still faulted',()=>{
    const result=assess(ring(120,162));
    expect(result.distanceKm).toBeLessThan(1);
    expect(result.closureThresholdM).toBe(CLOSURE_FLOOR_M);
    expect(result.closureDistanceM).toBeGreaterThan(CLOSURE_FLOOR_M);
    expect(result.isClosed).toBe(false);
    expect(result.issues).toContain('not-closed-loop');
  });

  test('a long loop missing more than the ceiling is still faulted',()=>{
    const result=assess(ring(2900,400));
    expect(result.distanceKm).toBeGreaterThan(15);
    expect(result.isClosed).toBe(false);
  });

  test('the threshold it was judged against is reported',()=>{
    const result=assess(ring(1068,101));
    expect(result.closureThresholdM).toBe(Math.round(closureToleranceM(result.distanceKm*1000)));
  });

  test('a caller may still state its own threshold',()=>{
    const points=ring(1068,101).map(([lat,lng])=>[lng,lat]);
    expect(assessGeometry(points,{routeShape:'loop',closureThresholdM:50}).isClosed).toBe(false);
  });

  // Nothing here touches a route that was never meant to close.
  test('a declared out-and-back is untouched',()=>{
    const result=assessGeometry(ring(1068,900).map(([lat,lng])=>[lng,lat]),{routeShape:'out-and-back'});
    expect(result.issues).not.toContain('not-closed-loop');
  });
});
