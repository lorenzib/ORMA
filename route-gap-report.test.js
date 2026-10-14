'use strict';

// The diagnostic's whole value is one distinction: a gap where the connecting
// way is already mapped (somebody edits the relation, minutes) against a gap
// where nothing is mapped (a survey, or the route is rejected). Getting that
// backwards sends the work to the wrong place, so the connectivity test is
// worth holding down even though the fetch around it cannot be.

const { gapsIn, boundingBox, connects, query, PUBLICATION_GAP_KM } =
  require('./scripts/report-route-gaps');

// ~380 m per 0.005 degrees of longitude at this latitude.
const way = coordinates => ({ geometry: coordinates.map(([lat, lon]) => ({ lat, lon })) });
const GAP = { from: [46.50, 11.000], to: [46.50, 11.030], metres: 2295 };

describe('deciding what a gap needs', () => {
  test('a mapped way joining the ends reads as a relation edit', () => {
    const verdict = connects([way([[46.50, 11.000], [46.50, 11.015], [46.50, 11.030]])], GAP);
    expect(verdict.connected).toBe(true);
    // And it says how far round, so a 300 m gap bridged by a 4 km detour is
    // visibly not the same as one bridged by a direct path.
    expect(verdict.alongPathsM).toBeGreaterThan(2000);
  });

  test('two ways that stop short of each other read as unmapped', () => {
    // The case that matters most: ways exist at both ends, so a check that
    // only asked "is anything mapped nearby" would wrongly say editable.
    const verdict = connects([
      way([[46.50, 11.000], [46.50, 11.004]]),
      way([[46.50, 11.026], [46.50, 11.030]]),
    ], GAP);
    expect(verdict.connected).toBe(false);
    expect(verdict.reason).toMatch(/do not join/);
  });

  test('nothing mapped at all is said plainly', () => {
    expect(connects([], GAP)).toEqual({ connected: false, reason: 'nothing mapped in the box' });
  });

  test('a route ending far from any way is not a missing member', () => {
    // There is no path where the route stops, so no relation edit fixes it.
    const verdict = connects([way([[46.60, 11.000], [46.60, 11.030]])], GAP);
    expect(verdict.connected).toBe(false);
    expect(verdict.reason).toMatch(/from any mapped way/);
  });

  test('ways meeting at the same point but not sharing a node still connect', () => {
    // Two ways drawn to the same spot are walkable even where the data does
    // not share a node id, and the question here is whether a walker gets
    // across -- not whether the tagging is tidy.
    const verdict = connects([
      way([[46.50, 11.000], [46.50, 11.015]]),
      way([[46.50, 11.015], [46.50, 11.030]]),
    ], GAP);
    expect(verdict.connected).toBe(true);
  });
});

describe('what it asks Overpass for', () => {
  test('the box covers both ends with room for a connector that loops out', () => {
    const [south, west, north, east] = boundingBox(GAP);
    expect(south).toBeLessThan(46.50);
    expect(north).toBeGreaterThan(46.50);
    expect(west).toBeLessThan(11.000);
    expect(east).toBeGreaterThan(11.030);
  });

  test('it asks only for ways a walk could use', () => {
    const asked = query(GAP);
    expect(asked).toContain('footway');
    expect(asked).toContain('path');
    // A connector reachable only along a motorway is not a walking connection.
    expect(asked).not.toContain('motorway');
    expect(asked).toContain('out geom;');
  });
});

describe('which routes it looks at', () => {
  test('a gap is one over the same limit that holds a trail back', () => {
    // Read from the publication rule rather than retyped, so the diagnostic
    // cannot start reporting on gaps the catalogue does not mind.
    expect(PUBLICATION_GAP_KM).toBe(1);
    const straight = { type: 'LineString', coordinates: [[11.000, 46.50], [11.005, 46.50]] };
    expect(gapsIn(straight)).toEqual([]);
    const broken = { type: 'LineString', coordinates: [[11.000, 46.50], [11.030, 46.50]] };
    expect(gapsIn(broken)).toHaveLength(1);
    expect(gapsIn(broken)[0].metres).toBeGreaterThan(1000);
  });
});
