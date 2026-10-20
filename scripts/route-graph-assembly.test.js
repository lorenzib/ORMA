'use strict';

/**
 * A relation is a network, and the walk is a route through it.
 *
 * Member ways were laid end to end: a line was extended at its two free ends
 * and nothing else. That cannot pass through a junction. Where three ways meet
 * it takes one continuation and orphans the third, and once a loop has closed
 * every junction on it is interior to a finished line, so anything branching
 * off is unreachable for good. The promoter then drew a straight line to
 * collect the orphan and the publication gate held the walk back for the jump.
 *
 * Seeweg (relation 3885162) is the shape that shows it, and the figures below
 * are measured from `api.openstreetmap.org/api/0.6/relation/3885162/full.json`
 * on 20 Oct 2026: 48 members, one connected network of 11.75 km, a closed
 * western loop plus an eastern lobe on two three-way junctions. End to end it
 * came out as three pieces and 3.12 km of straight line across the valley.
 * Traversed as a graph it is one line of 11.7 km whose widest step is 466 m,
 * and that step is a straight run of mapped path inside a single way.
 *
 * Measured across all 149 catalogue relations, graph assembly took 22 of them
 * from several pieces to one -- Gsieser Talblickweg from 31 -- left none with
 * more pieces than before, and brought the number whose drawn line is more
 * than 3% off the ground its own members cover from 52 down to 3.
 */

const { stitchMembers, junctionGraph, componentsOf, isRouteMember,
  STITCH_TOLERANCE_M, COINCIDENT_END_M } = require('./fetch-dog-friendly-routes.js');

const R = 6371000;
const metres = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const length = (line) => {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) total += metres(line[i - 1], line[i]);
  return total;
};
const widestStep = (line) => {
  let widest = 0;
  for (let i = 1; i < line.length; i += 1) widest = Math.max(widest, metres(line[i - 1], line[i]));
  return widest;
};
/** A member way, in the shape both transports hand `stitchMembers`. */
let nextRef = 1;
const way = (coords, role) => ({ type: 'way', ref: nextRef++,
  geometry: coords.map(([lng, lat]) => ({ lon: lng, lat })), ...(role ? { role } : {}) });
/** The ground a relation's own on-route members cover, counting repeats. */
const memberMetres = (members) => members
  .filter((m) => isRouteMember(m) && m.geometry.length > 1)
  .reduce((total, m) => total + length(m.geometry.map((p) => [p.lon, p.lat])), 0);

// A figure-of-eight in miniature, built the way OSM maps one: a square loop
// through two junctions, and a lobe hanging off both of them. Coordinates are
// [lng, lat] near Val d'Ultimo, and the squares are a few hundred metres
// across so a weld is plainly distinguishable from a step along the walk.
const WEST = [11.000, 46.540];
const JUNCTION_A = [11.004, 46.540];
const JUNCTION_B = [11.004, 46.536];
const SOUTH_WEST = [11.000, 46.536];
const EAST = [11.008, 46.540];
const SOUTH_EAST = [11.008, 46.536];

// The closed western loop: four ways round a square, two of whose corners are
// the junctions the lobe hangs from.
const LOOP = () => [
  way([WEST, JUNCTION_A]),
  way([JUNCTION_A, JUNCTION_B]),
  way([JUNCTION_B, SOUTH_WEST]),
  way([SOUTH_WEST, WEST]),
];
// The eastern lobe: out from one junction, round, and back to the other.
const LOBE = () => [
  way([JUNCTION_A, EAST]),
  way([EAST, SOUTH_EAST]),
  way([SOUTH_EAST, JUNCTION_B]),
];

describe('a branch at a junction is followed, not orphaned', () => {
  test('a closed loop with a lobe on two junctions is one line', () => {
    const members = [...LOOP(), ...LOBE()];
    const lines = stitchMembers(members);
    expect(lines).toHaveLength(1);
    // Every member is in the line, and none of it is invented: the ways meet
    // exactly, so the drawn line is the ground they cover.
    expect(length(lines[0])).toBeCloseTo(memberMetres(members), 0);
  });

  test('the loop closing first does not strand the lobe', () => {
    // The order the relation lists its members in is the order end-to-end
    // stitching closed the loop in, which is what made the lobe unreachable.
    // Listing the loop first must not cost anything now.
    const loopFirst = stitchMembers([...LOOP(), ...LOBE()]);
    const lobeFirst = stitchMembers([...LOBE(), ...LOOP()]);
    expect(loopFirst).toHaveLength(1);
    expect(lobeFirst).toHaveLength(1);
    expect(length(loopFirst[0])).toBeCloseTo(length(lobeFirst[0]), 0);
  });

  test('no step in the line is a jump across the shape', () => {
    // The whole fault: a straight line from the loop to the lobe. Here the
    // members meet exactly, so every step the line takes has to be a member
    // of its own -- nothing longer than the longest way can appear.
    const members = [...LOOP(), ...LOBE()];
    const [line] = stitchMembers(members);
    const longest = Math.max(...members.map((m) => length(m.geometry.map((p) => [p.lon, p.lat]))));
    expect(widestStep(line)).toBeCloseTo(longest, 0);
  });

  test('a three-way junction keeps all three of its ways', () => {
    // A spur off the middle of a walk. End to end, closing the walk first
    // leaves the spur in the pool; here it is walked out and back.
    const members = [
      way([WEST, JUNCTION_A]),
      way([JUNCTION_A, JUNCTION_B]),
      way([JUNCTION_A, EAST]),
    ];
    const lines = stitchMembers(members);
    expect(lines).toHaveLength(1);
    const graph = junctionGraph(members.map((m) => m.geometry.map((p) => [p.lon, p.lat])));
    expect(Math.max(...graph.degree)).toBe(3);
  });
});

describe('what the line is made of', () => {
  test('every member is walked, and nothing is walked that is not a member', () => {
    const members = [...LOOP(), ...LOBE()];
    const drawn = new Set();
    for (const line of stitchMembers(members)) {
      for (const point of line) drawn.add(`${point[0]},${point[1]}`);
    }
    for (const member of members) {
      for (const point of member.geometry) {
        expect(drawn.has(`${point.lon},${point.lat}`)).toBe(true);
      }
    }
    const listed = new Set(members.flatMap((m) => m.geometry.map((p) => `${p.lon},${p.lat}`)));
    for (const point of drawn) expect(listed.has(point)).toBe(true);
  });

  test('a way the relation lists twice is walked twice', () => {
    // An out-and-back spur is mapped by listing its way a second time, and
    // the relations' own `distance` tags corroborate the doubled length. So
    // the member list is taken as given rather than de-duplicated: Albannette
    // petite boucle lists nine ways twice and is 5.01 km as listed against
    // 3.99 km de-duplicated, matching its `distance` tag of 5.0.
    const there = [JUNCTION_A, EAST];
    const members = [way([WEST, JUNCTION_A]), way(there), way(there)];
    const [line] = stitchMembers(members);
    expect(length(line)).toBeCloseTo(memberMetres(members), 0);
    expect(length(line)).toBeGreaterThan(length([WEST, JUNCTION_A, EAST]));
  });

  test('a member running through another member\'s end is cut there', () => {
    // OSM only splits a way where it has to, so a ring hanging off the middle
    // of a longer way is mapped as exactly that. Three catalogue relations
    // have one -- Natur- und Kulturweg, Valser Rundweg and Rundweg Montiggler
    // Seen -- and without the cut the ring is a piece nothing can reach.
    const through = [WEST, JUNCTION_A, JUNCTION_B];
    const ring = [JUNCTION_A, EAST, SOUTH_EAST, JUNCTION_A];
    const members = [way(through), way(ring)];
    const lines = stitchMembers(members);
    expect(lines).toHaveLength(1);
    expect(length(lines[0])).toBeCloseTo(memberMetres(members), 0);
  });

  test('no members at all is not an error', () => {
    expect(stitchMembers([])).toEqual([]);
    expect(stitchMembers(undefined)).toEqual([]);
    expect(stitchMembers([way([WEST, JUNCTION_A], 'approach')])).toEqual([]);
  });
});

describe('a hole in the map stays a hole', () => {
  test('two groups too far apart to join stay two lines', () => {
    // The connector the promoter then draws is a hole in OpenStreetMap, and
    // leaving it visible is what holds the walk back. Three catalogue
    // relations are genuinely detached like this, by 1 to 10 km.
    const far = [[11.100, 46.600], [11.104, 46.600]];
    const lines = stitchMembers([...LOOP(), way(far)]);
    expect(lines).toHaveLength(2);
  });

  test('the tolerance joins a loose end and nothing else', () => {
    // Two dead ends within the tolerance are one walk continuing: Seeweg's
    // eastern tip fails to close by 13 m, and Gsieser Talblickweg's route is
    // mapped in groups separated by 44 m and 85 m.
    const tip = [11.008, 46.5362];           // ~22 m from SOUTH_EAST
    const nearlyClosing = [...LOOP(), way([JUNCTION_A, EAST]), way([EAST, tip]),
      way([SOUTH_EAST, JUNCTION_B])];
    expect(metres(tip, SOUTH_EAST)).toBeLessThan(STITCH_TOLERANCE_M);
    expect(stitchMembers(nearlyClosing)).toHaveLength(1);
  });

  test('two loose ends further apart than the tolerance stay two places', () => {
    // The lobe's tip stops 167 m short of the loop's. Both are dead ends, and
    // joining them is exactly what the tolerance does at 13 m and must not do
    // here -- so the walk keeps the two ends it really has.
    const away = [11.008, 46.5345];
    expect(metres(away, SOUTH_EAST)).toBeGreaterThan(STITCH_TOLERANCE_M);
    const members = [...LOOP(), way([JUNCTION_A, EAST]), way([EAST, away]),
      way([SOUTH_EAST, JUNCTION_B])];
    const graph = junctionGraph(members.map((m) => m.geometry.map((p) => [p.lon, p.lat])));
    const loose = graph.degree.filter((d) => d === 1);
    expect(loose).toHaveLength(2);
    // And the line is still honest about its length: nothing was invented to
    // close the 167 m, and nothing was left out.
    const [line] = stitchMembers(members);
    const shortest = Math.min(...members.map((m) => length(m.geometry.map((p) => [p.lon, p.lat]))));
    expect(length(line)).toBeCloseTo(memberMetres(members) + shortest, 0);
  });

  test('the widest gap the catalogue needs bridged is inside the tolerance', () => {
    // Measured over all 149 relations on 20 Oct 2026: 22 of them need a loose
    // end joined, 28 joins in all, and the widest is 93 m. Seeweg's is 13 m,
    // Gsieser's 44 m, Albannette's 74 m and 15 m, PARCOURS N°11's 24 m.
    expect(STITCH_TOLERANCE_M).toBeGreaterThan(93);
  });
});

describe('ends that coincide are one junction', () => {
  test('the two tolerances are a long way apart on purpose', () => {
    // Spending the loose tolerance on deciding what a junction IS forgets
    // which ends actually touch, and the line then welds across the slack
    // rather than through the join. Measured: 1.05 km of invented line in
    // Lang-Erl-Weg's 2.86 km walk, 3.47 km in Gsieser's, and 33 relations
    // left with a junction whose own ends lay further apart than the
    // tolerance that had merged them.
    expect(COINCIDENT_END_M).toBeLessThan(STITCH_TOLERANCE_M / 50);
  });

  test('a weld crosses the gap it is bridging and nothing more', () => {
    // Three ways chained with ~38 m between consecutive ends. The drawn line
    // is the ground they cover plus those two gaps -- not the 76 m end to end
    // that a junction merging all three ends together could weld across.
    const a = [[11.000, 46.540], [11.004, 46.540]];
    const b = [[11.0045, 46.540], [11.0085, 46.540]];
    const c = [[11.009, 46.540], [11.013, 46.540]];
    const gaps = metres(a[1], b[0]) + metres(b[1], c[0]);
    expect(gaps).toBeGreaterThan(70);
    expect(gaps).toBeLessThan(80);
    const members = [way(a), way(b), way(c)];
    const [line] = stitchMembers(members);
    expect(length(line)).toBeCloseTo(memberMetres(members) + gaps, 0);
  });

  test('an end a tolerance away from a junction is not swallowed by it', () => {
    // Two ways meeting exactly at a junction, and a third whose end lies 38 m
    // off it. Merging all three into one place is what drew 1.05 km of
    // invented line into Lang-Erl-Weg: the junction is where ends coincide,
    // and the loose tolerance only ever joins two loose ends. This third way
    // has nothing loose to meet, so it stays a line of its own rather than
    // being welded to the middle of the walk.
    const walk = [way([WEST, JUNCTION_A]), way([JUNCTION_A, JUNCTION_B])];
    const offset = [11.0045, 46.540];
    expect(metres(offset, JUNCTION_A)).toBeLessThan(STITCH_TOLERANCE_M);
    expect(metres(offset, JUNCTION_A)).toBeGreaterThan(COINCIDENT_END_M);
    const members = [...walk, way([offset, EAST])];
    const graph = junctionGraph(members.map((m) => m.geometry.map((p) => [p.lon, p.lat])));
    expect(graph.degree.filter((d) => d === 3)).toEqual([]);
    expect(componentsOf(graph)).toHaveLength(2);
    expect(stitchMembers(members)).toHaveLength(2);
  });

  test('a junction counts the ends that meet at it', () => {
    const graph = junctionGraph([...LOOP(), ...LOBE()]
      .map((m) => m.geometry.map((p) => [p.lon, p.lat])));
    expect(componentsOf(graph)).toHaveLength(1);
    // Four corners, two of which the lobe also arrives at, plus its own two.
    const degrees = graph.degree.slice().sort((x, y) => y - x);
    expect(degrees.slice(0, 2)).toEqual([3, 3]);
    // A way that closes on itself contributes two ends, so it stays even.
    const ring = junctionGraph([[WEST, JUNCTION_A, JUNCTION_B, WEST]]);
    expect(ring.degree).toEqual([2]);
  });
});

describe('where a stretch has to be walked twice', () => {
  // A single line can use every member once only where at most two junctions
  // have an odd number of ends meeting at them. Above that some stretch has to
  // be covered twice, which is what a walker does at a dead end. Four
  // catalogue relations are shaped that way and all four retrace 12-293 m.
  const THREE_SPURS = () => [
    way([JUNCTION_A, WEST]),
    way([JUNCTION_A, EAST]),
    way([JUNCTION_A, JUNCTION_B]),
  ];

  test('it is still one line', () => {
    const lines = stitchMembers(THREE_SPURS());
    expect(lines).toHaveLength(1);
  });

  test('the ground walked twice is counted, because it is real ground', () => {
    // Unlike a connector, which is a straight line over a hole in the map and
    // is left out of the distance, a retraced stretch is path underfoot.
    const members = THREE_SPURS();
    const [line] = stitchMembers(members);
    const shortest = Math.min(...members.map((m) => length(m.geometry.map((p) => [p.lon, p.lat]))));
    expect(length(line)).toBeCloseTo(memberMetres(members) + shortest, 0);
  });

  test('and it is walked along the route, not across country', () => {
    // Every step stays within the longest single member, so the line doubles
    // back along mapped path rather than cutting from one spur tip to another.
    const members = THREE_SPURS();
    const [line] = stitchMembers(members);
    const longest = Math.max(...members.map((m) => length(m.geometry.map((p) => [p.lon, p.lat]))));
    expect(widestStep(line)).toBeLessThanOrEqual(longest);
  });

  test('the shortest stretch is the one chosen to walk twice', () => {
    // Three spurs of plainly different lengths: the retrace is the short one.
    const members = [
      way([JUNCTION_A, [11.000, 46.540]]),     // ~307 m
      way([JUNCTION_A, [11.030, 46.540]]),     // ~1990 m
      way([JUNCTION_A, [11.0045, 46.540]]),    // ~38 m
    ];
    const [line] = stitchMembers(members);
    expect(length(line)).toBeCloseTo(memberMetres(members) + 38, -1);
  });
});
