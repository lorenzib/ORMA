'use strict';

/**
 * The walking line is the route's own members, not everything in the relation.
 *
 * Measured 16 October 2026: 53 of the 126 catalogue relations carry member
 * roles, 43 of them roles that are not the route, and 18 of the 22 trails held
 * out of publication were held by the resulting jump. The shapes below are the
 * two that blocked the verification gate -- a `roundtrip=yes` relation whose
 * plain members close into a loop, plus an approach or excursion spur a couple
 * of kilometres off, which the stitcher appended as though a walker carried on
 * into it.
 */

const { OFF_ROUTE_ROLES, isRouteMember, stitchMembers, isClosedLoop } =
  require('./fetch-dog-friendly-routes');

// Vandoies/Vintl, where relation 11795251 starts. A ~330 m square of plain
// members, so the loop is a loop and the stitcher has endpoints to join.
const LOOP = [
  [{ lat: 46.8167, lon: 11.7230 }, { lat: 46.8167, lon: 11.7270 }],
  [{ lat: 46.8167, lon: 11.7270 }, { lat: 46.8197, lon: 11.7270 }],
  [{ lat: 46.8197, lon: 11.7270 }, { lat: 46.8197, lon: 11.7230 }],
  // Closes ~9 m from the start, the way a real stitched loop does.
  [{ lat: 46.8197, lon: 11.7230 }, { lat: 46.81678, lon: 11.7230 }],
];
// Where relation 11795251's 2.48 km jump landed.
const SPUR = [{ lat: 46.81516, lon: 11.75532 }, { lat: 46.81516, lon: 11.75932 }];

const way = (geometry, role) => ({ type: 'way', ref: 1, geometry, ...(role ? { role } : {}) });
const loopMembers = () => LOOP.map(geometry => way(geometry));
const flat = lines => lines.flat().map(([lon, lat]) => `${lon},${lat}`);
const hasSpur = lines => flat(lines).includes(`${SPUR[0].lon},${SPUR[0].lat}`);

describe('a member that is not the route is not stitched into the walk', () => {
  for(const role of ['approach', 'excursion', 'alternative', 'alternate', 'link', 'connection']){
    test(`a ${role} member is left out`, () => {
      const lines = stitchMembers([...loopMembers(), way(SPUR, role)]);
      // With the spur stitched in it cannot join the loop -- it is 2.5 km off
      // and the stitcher joins within 30 m -- so it arrives as a second line
      // and the walk acquires a jump to it.
      expect(lines).toHaveLength(1);
      expect(hasSpur(lines)).toBe(false);
    });
  }

  test('the loop itself still closes, with the spur gone', () => {
    // "Closes" as production means it: ends meeting within LOOP_CLOSE_METERS,
    // which is what a real stitched loop does rather than landing bit-exactly
    // back on its first coordinate.
    expect(isClosedLoop(stitchMembers([...loopMembers(), way(SPUR, 'approach')]))).toBe(true);
  });

  test('several off-route members at once are all left out', () => {
    // Relation 11795251: 2 approach and 7 excursion ways beside 49 plain ones.
    const lines = stitchMembers([...loopMembers(),
      way(SPUR, 'approach'), way(SPUR, 'excursion'), way(SPUR, 'excursion')]);
    expect(lines).toHaveLength(1);
    expect(hasSpur(lines)).toBe(false);
  });

  test('a relation of nothing but off-route members yields no line', () => {
    // Better than a line made of spurs: downstream drops an empty geometry,
    // where a bogus one would be published.
    expect(stitchMembers([way(SPUR, 'approach')])).toEqual([]);
  });
});

describe('a direction role is the route, and must survive', () => {
  // The guard that matters. Nine catalogue relations tag EVERY member forward
  // or backward and have no plain member at all, so treating any role as
  // off-route erases them: osm-10539302, osm-12118490, osm-12121346,
  // osm-12121548, osm-12121798, osm-12127424, osm-15535697, osm-16218739, and
  // osm-21021130. Two of those are trails the verification gate would pass.
  for(const role of ['forward', 'backward']){
    test(`a relation of only ${role} members keeps its geometry`, () => {
      const lines = stitchMembers(LOOP.map(geometry => way(geometry, role)));
      expect(lines).toHaveLength(1);
      expect(lines[0].length).toBeGreaterThan(2);
    });
  }

  test('a route that splits keeps both carriageways', () => {
    const lines = stitchMembers([way(LOOP[0], 'forward'), way(LOOP[1], 'backward'),
      way(LOOP[2]), way(LOOP[3])]);
    expect(lines).toHaveLength(1);
    expect(isClosedLoop(lines)).toBe(true);
  });

  test('neither direction is in the off-route list', () => {
    expect(OFF_ROUTE_ROLES.has('forward')).toBe(false);
    expect(OFF_ROUTE_ROLES.has('backward')).toBe(false);
  });
});

describe('how an unfamiliar role is treated', () => {
  test('a role nobody has met yet is kept', () => {
    // Deliberately the conservative direction: wrongly keeping a member
    // repeats a jump the 1 km rule already catches, while wrongly dropping one
    // deletes a walk's geometry and nothing catches that.
    const lines = stitchMembers(LOOP.map(geometry => way(geometry, 'main')));
    expect(lines).toHaveLength(1);
  });

  test('the role is read whatever its spacing or case', () => {
    expect(isRouteMember({ type: 'way', role: 'Approach' })).toBe(false);
    expect(isRouteMember({ type: 'way', role: ' excursion ' })).toBe(false);
    expect(isRouteMember({ type: 'way', role: '' })).toBe(true);
    expect(isRouteMember({ type: 'way' })).toBe(true);
  });

  test('only ways are route members', () => {
    // A relation carries node members too -- a guidepost, a car park -- and
    // relation 11795251 has two of them with an approach role.
    expect(isRouteMember({ type: 'node', role: '' })).toBe(false);
    expect(isRouteMember(null)).toBe(false);
  });

  test('no members at all is not an error', () => {
    expect(stitchMembers([])).toEqual([]);
    expect(stitchMembers(undefined)).toEqual([]);
  });
});
