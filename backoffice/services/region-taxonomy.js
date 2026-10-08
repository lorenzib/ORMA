'use strict';

/**
 * ORMA's locality-to-valley taxonomy, loaded for Node.
 *
 * `regions-config.js` is a browser IIFE that assigns to `window`, and it is
 * deliberately the only copy of that table: the import pipeline used to carry
 * its own, the two drifted, and a trail could be given an `area` from one list
 * and a `valley` from the other, naming different places.
 *
 * Three callers now need it server-side — the coverage report, the scouting
 * planner and the live scouting refresh — so the sandbox lives here once rather
 * than three times, for the same reason the table itself does.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadRegionTaxonomy(root){
  const context = { window:{}, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'regions-config.js'), 'utf8'), context,
    { filename:'regions-config.js' });
  return context.window.DoloPawsRegions;
}

/**
 * Just the lookup, or null when the table cannot be read. Null is a usable
 * answer: every caller falls back to the ordering it had before the valley was
 * known, rather than failing.
 */
function nearestLocalityFor(root){
  try {
    const taxonomy = loadRegionTaxonomy(root);
    return typeof taxonomy?.nearestLocality === 'function' ? taxonomy.nearestLocality : null;
  } catch { return null; }
}

module.exports = { loadRegionTaxonomy, nearestLocalityFor };
