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
    for(const trail of withdrawn){
      expect(bar.isVerified(trail)).toBe(false);
    }
  });

  test('a walk whose seal was withdrawn keeps its hand research from the pipeline',()=>{
    // materialize-approved-publications.js refuses a publication over a
    // walk marked sealWithdrawn, as it does over a Verified one. The 78
    // withdrawn on 29 October lose the mark as their directions are written
    // and their seal comes back, so the count only falls.
    const marked=trails.filter(trail=>trail.sealWithdrawn);
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.length).toBeLessThanOrEqual(78);
    for(const trail of marked) expect(trail.sealWithdrawn.reason).toBe('no-directions-on-page');
  });
});
