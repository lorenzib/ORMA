'use strict';

/**
 * Every trail's `area` label is picked by a nearest-of-N lookup over a fixed
 * locality table, and that lookup has no upper bound: when the table does not
 * cover a valley it still returns an answer, naming whatever town happens to be
 * closest. A trail at Naturns was labelled "Bolzano / Bozen", 31 km away, and
 * forty trails were in that state before the table was extended.
 *
 * The label is user-facing: it is on the trail card, in the page subtitle, in
 * the "start at ..." copy and in the search index. These tests fail when a new
 * import reaches ground the table does not cover, which is the only warning the
 * lookup itself will ever give.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadProductionTrails } = require('./scripts/load-production-trails');

const ROOT = __dirname;

// The furthest a trail may sit from the place its label names. The failures
// this guards against ran from 10.4 to 31.5 km; the worst legitimate case in
// the catalogue is 9.5 km, so this leaves real headroom without letting the
// old class of error back in.
const MAX_LABEL_KM = 12;

function loadRegions() {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'regions-config.js'), 'utf8'), context,
    { filename: 'regions-config.js' });
  return context.window.DoloPawsRegions;
}

function kmBetween(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const regions = loadRegions();
const byName = new Map(regions.LOCALITIES.map(([name, lat, lng]) => [name, [lat, lng]]));
const trails = loadProductionTrails(ROOT).filter((t) => typeof t.lat === 'number');

describe('locality table coverage', () => {
  test('the import pipeline and the runtime share one locality table', () => {
    const generator = fs.readFileSync(path.join(ROOT, 'scripts/promote-osm-trails.js'), 'utf8');
    // A second copy is what let `area` and `valley` name different places: the
    // two lists drifted by five entries, so a trail could be given "Courchevel"
    // from one and "La Plagne" from the other.
    expect(generator).not.toMatch(/const LOCALITIES\s*=\s*\[/);
    expect(generator).toContain('regions-config.js');
  });

  test('no trail is labelled with a place it is nowhere near', () => {
    const strays = trails
      .filter((t) => byName.has(t.area))
      .map((t) => {
        const [lat, lng] = byName.get(t.area);
        return { id: t.id, name: t.name, area: t.area, km: kmBetween(t.lat, t.lng, lat, lng) };
      })
      .filter((row) => row.km > MAX_LABEL_KM)
      .sort((a, b) => b.km - a.km)
      .map((row) => `${row.id} (${row.name}) is ${row.km.toFixed(1)} km from "${row.area}"`);

    expect(strays).toEqual([]);
  });

  test('every trail has a locality within reach, so the table covers the catalogue', () => {
    const orphans = trails
      .map((t) => ({ id: t.id, name: t.name, nearest: regions.nearestLocality(t.lat, t.lng) }))
      .filter((row) => row.nearest.km > MAX_LABEL_KM * 2)
      .map((row) => `${row.id} (${row.name}): nearest locality ` +
        `"${row.nearest.name}" is ${row.nearest.km.toFixed(1)} km away`);

    expect(orphans).toEqual([]);
  });

  test('a locality never names a valley it does not belong to', () => {
    // Bolzano was filed under "Val di Fiemme – Latemar" and Vipiteno under
    // "Val di Funes – Odle". Both are large enough to win the nearest-locality
    // lookup across a wide area, so each handed its wrong valley to every trail
    // that fell through to it. Check every locality sits closer to the other
    // members of its own valley than the valley's span would suggest.
    const byValley = new Map();
    for (const [name, lat, lng, valley] of regions.LOCALITIES) {
      if (!byValley.has(valley)) byValley.set(valley, []);
      byValley.get(valley).push({ name, lat, lng });
    }

    const outliers = [];
    for (const [valley, members] of byValley) {
      if (members.length < 2) continue;
      for (const member of members) {
        const nearestSibling = Math.min(...members
          .filter((other) => other.name !== member.name)
          .map((other) => kmBetween(member.lat, member.lng, other.lat, other.lng)));
        if (nearestSibling > 40) {
          outliers.push(`"${member.name}" is ${nearestSibling.toFixed(1)} km from anything ` +
            `else in "${valley}"`);
        }
      }
    }

    expect(outliers).toEqual([]);
  });
});
