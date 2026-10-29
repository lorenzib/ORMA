'use strict';

const {loadProductionTrails}=require('./scripts/load-production-trails');
const bar=require('./scripts/board-walk-bar');

/**
 * A Verified walk must say how to follow it, on its page. On 29 October 2026
 * 78 Verified walks -- none of them board walks, so the board-walk bar never
 * saw them -- showed only "No verified numbered sequence is currently
 * recorded", and the owner withdrew their seal. A walk is followed by trail
 * numbers, or by a structured guidance block (numbered or landmark); a walk
 * with neither is not Verified, whatever its research notes say.
 */
describe('every Verified walk shows directions on its page',()=>{
  const trails=loadProductionTrails(__dirname);
  const verified=trails.filter(bar.isVerified);

  test('there are Verified walks to check',()=>{
    expect(verified.length).toBeGreaterThan(0);
  });

  test('none of them falls back to "no verified numbered sequence"',()=>{
    const without=verified
      .filter(trail=>!bar.directionsOf(trail).shownOnPage)
      .map(trail=>`${trail.id} ${trail.name}`);
    expect(without).toEqual([]);
  });

  test('a walk withdrawn for want of directions says so in its blocker',()=>{
    const withdrawn=trails.filter(trail=>trail.graduation&&trail.graduation.blockers
      &&/page shows no directions/.test(String(trail.graduation.blockers.routeNumbers||'')));
    expect(withdrawn.length).toBeGreaterThan(0);
    for(const trail of withdrawn) expect(bar.isVerified(trail)).toBe(false);
  });
});
