'use strict';

const {rebuildLostTheRoute,withoutRebuildFaults,metres,REBUILD_DERIVED,
  INCOMPLETE_REBUILD_NOTE,LOST_SHARE}=require('./workflows/reconstruction-quality');
const {UNWAIVABLE_BLOCKER_IDS}=require('./workflows/compile-verified-dossier');
const {loadProductionTrails}=require('../scripts/load-production-trails');
const path=require('path');

/**
 * All 23 rejected trails were rejected on geometry. Measured 13 October on
 * three of them: ORMA's own line matches the published distance to within half
 * a percent, and the rebuilt line is short by 14 to 27 per cent. The route is
 * not wrong; the rebuild could not stitch the relation whole, and every metric
 * taken from it is then wrong too.
 */

// A straight line of a given length, so held lengths are measured rather than
// asserted.
function line(km){
  const steps=50, degPerKm=1/111.32;
  return Array.from({length:steps+1},(_,i)=>[46.5+(km*degPerKm)*(i/steps),11.5]);
}

describe('telling a short rebuild from a broken route',()=>{
  test('a rebuild that lost a fifth of a corroborated line has failed',()=>{
    const r=rebuildLostTheRoute({rebuiltKm:5.35,heldPath:line(6.6),officialKm:6.6});
    expect(r.incomplete).toBe(true);
    expect(r.lostSharePercent).toBeGreaterThan(15);
  });

  test('a rebuild that kept the route is not faulted',()=>{
    expect(rebuildLostTheRoute({rebuiltKm:6.55,heldPath:line(6.6),officialKm:6.6}).incomplete).toBe(false);
  });

  // The guard that stops this excusing a genuinely wrong trail: ORMA's line has
  // to agree with the authority before it can stand in for the rebuild.
  test('a short rebuild is NOT excused when the held line is wrong too',()=>{
    const r=rebuildLostTheRoute({rebuiltKm:3,heldPath:line(4),officialKm:10});
    expect(r.incomplete).toBe(false);
    expect(r.heldAgreesWithOfficial).toBe(false);
  });

  test('a rebuild LONGER than the held line is never excused',()=>{
    expect(rebuildLostTheRoute({rebuiltKm:9,heldPath:line(6.6),officialKm:6.6}).incomplete).toBe(false);
  });

  test('a loss just under the threshold still counts as the same route',()=>{
    const held=10;
    const r=rebuildLostTheRoute({rebuiltKm:held*(1-LOST_SHARE/2),heldPath:line(held),officialKm:held});
    expect(r.incomplete).toBe(false);
  });

  test('nothing to compare is not a finding',()=>{
    expect(rebuildLostTheRoute({rebuiltKm:5,heldPath:null,officialKm:6}).incomplete).toBe(false);
    expect(rebuildLostTheRoute({rebuiltKm:5,heldPath:line(6),officialKm:null}).incomplete).toBe(false);
    expect(metres([[46.5,11.5]])).toBeNull();
  });

  // Derived from the catalogue, with the rebuilt figures read from the trails'
  // own stored audits rather than retyped as a target.
  test('the three real trails are all recognised',()=>{
    const trails=loadProductionTrails(path.resolve(__dirname,'..'));
    for(const [id,rebuiltKm] of [['osm-3982382',4.23],['osm-14095296',5.35],['osm-11795251',9.66]]){
      const trail=trails.find(t=>t.id===id);
      const r=rebuildLostTheRoute({rebuiltKm,heldPath:trail.path,officialKm:trail.distance});
      expect([id,r.incomplete]).toEqual([id,true]);
    }
  });
});

describe('which faults belong to the rebuild',()=>{
  test('connectivity and length are set aside, identity is not',()=>{
    const kept=withoutRebuildFaults(['disconnected-components','official-distance-conflict',
      'not-closed-loop','relation-not-hiking-route','route-source-identity-contradicted']);
    expect(kept).toEqual(['relation-not-hiking-route','route-source-identity-contradicted']);
  });

  test('every fault it sets aside is one a rebuild can cause',()=>{
    for(const blocker of REBUILD_DERIVED) expect(UNWAIVABLE_BLOCKER_IDS).toContain(blocker);
  });

  // The note replaces them, so a trail is never silently cleared: the audit
  // says it could not do its job, and that is not in the unwaivable set because
  // a trail cannot answer for it.
  test('the note is not something the trail is faulted for',()=>{
    expect(UNWAIVABLE_BLOCKER_IDS).not.toContain(INCOMPLETE_REBUILD_NOTE);
  });

  test('a clean rebuild keeps every blocker it found',()=>{
    const found=['relation-not-hiking-route'];
    expect(withoutRebuildFaults(found)).toEqual(found);
    expect(withoutRebuildFaults([])).toEqual([]);
  });
});
