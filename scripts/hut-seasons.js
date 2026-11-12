'use strict';

// When the staffed huts on a walk are open, from data/hut-seasons.json. The
// huts publish dates, not months, and a new set each season; the file keeps
// the latest published dates per hut and says which season they are for. Each
// walk that passes a dated hut gets it in trail.season.huts:
//
//   { id, name, osmId, goal, periods: [{from: 'MM-DD', to: 'MM-DD'}],
//     closedMonths, approx, summerOnly | winterOnly, datesFor, url, accessedAt }
//
// A hut is information, not a limit: a walk to a shut hut is still a walk, so
// hut dates never change a walk's months. `closedMonths` are the months the hut
// is shut for the whole month, and only among the months its dates speak for
// (`knownMonths`): a hut that has published summer dates only is not known to
// be shut in winter. The page notes a closed hut the walk walks to (`goal`).

const { runningDays } = require('./lift-seasons');

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const SEASON_YEAR = /^\d{4}(\/\d{2})?$/;

/** The months, among those its dates speak for, a hut is shut on every day of. */
function closedMonths(hut){
  const days = runningDays(hut.periods);
  const closed = [];
  let first = 1;
  MONTH_DAYS.forEach((length, i) => {
    let open = false;
    for(let d = first; d < first + length; d += 1) if(days.has(d)) open = true;
    if(!open) closed.push(i + 1);
    first += length;
  });
  const known = new Set(hut.knownMonths || ALL_MONTHS);
  return closed.filter(m => known.has(m));
}

function validateHut(id, hut){
  if(!hut || typeof hut.name !== 'string' || !hut.name.trim()) throw new Error(`Hut ${id} has no name`);
  if(!Array.isArray(hut.periods) || !hut.periods.length) throw new Error(`Hut ${id} has no opening periods`);
  for(const period of hut.periods){
    if(!MD.test(period.from || '') || !MD.test(period.to || '')) throw new Error(`Hut ${id} has a period that is not MM-DD to MM-DD`);
  }
  if(!/^https?:\/\//.test(hut.url || '')) throw new Error(`Hut ${id} has no source url`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(hut.accessedAt || '')) throw new Error(`Hut ${id} has no read-on date`);
  const dates = hut.datesFor || {};
  const keys = Object.keys(dates);
  if(!keys.length || !keys.every(key => ['summer', 'winter', 'year'].includes(key) && SEASON_YEAR.test(dates[key]))){
    throw new Error(`Hut ${id} does not say which season its dates are for`);
  }
  if(hut.knownMonths !== undefined && !(Array.isArray(hut.knownMonths) && hut.knownMonths.every(m => Number.isInteger(m) && m >= 1 && m <= 12))){
    throw new Error(`Hut ${id} has bad knownMonths`);
  }
}

function applyHutSeasons(trails, artifact){
  const huts = (artifact && artifact.huts) || {};
  const uses = (artifact && artifact.trails) || {};
  Object.entries(huts).forEach(([id, hut]) => validateHut(id, hut));
  const known = new Set(trails.map(trail => trail.id));
  for(const [trailId, use] of Object.entries(uses)){
    if(!known.has(trailId)) throw new Error(`Hut seasons name an unknown walk: ${trailId}`);
    for(const hutId of use.huts || []) if(!huts[hutId]) throw new Error(`Hut seasons for ${trailId} name an unknown hut: ${hutId}`);
    for(const hutId of use.goals || []) if(!(use.huts || []).includes(hutId)) throw new Error(`Hut seasons for ${trailId} name a goal it does not pass: ${hutId}`);
  }
  return trails.map(trail => {
    const use = uses[trail.id];
    if(!use || !trail.season) return trail;
    const goals = new Set(use.goals || []);
    const records = use.huts.map(hutId => {
      const hut = huts[hutId];
      const known = hut.knownMonths && hut.knownMonths.length < 12 ? hut.knownMonths : null;
      return {
        id: hutId, name: hut.name, ...(hut.osmId ? { osmId: hut.osmId } : {}), goal: goals.has(hutId),
        periods: hut.periods.map(({ from, to }) => ({ from, to })),
        closedMonths: closedMonths(hut),
        ...(hut.approx ? { approx: true } : {}),
        ...(known ? (known.every(m => m >= 11 || m <= 4) ? { winterOnly: true } : { summerOnly: true }) : {}),
        datesFor: { ...hut.datesFor }, url: hut.url, accessedAt: hut.accessedAt,
      };
    });
    return { ...trail, season: { ...trail.season, huts: records } };
  });
}

module.exports = { applyHutSeasons, closedMonths, validateHut };
