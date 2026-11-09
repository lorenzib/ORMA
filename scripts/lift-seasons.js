'use strict';

// When the lifts that walks ride are running, from data/lift-seasons.json. The
// operators publish dates, not months, and a new set each year; the file keeps
// the latest published dates per lift, says which year they are, and each walk
// that rides a lift gets them in trail.season.lifts:
//
//   { id, name, required, periods: [{from: 'MM-DD', to: 'MM-DD'}], shutMonths,
//     datesFor, operator, url, accessedAt, climbM? }
//
// A lift runs in a month when it runs for at least half of it: a gondola that
// opens on 30 May runs in June, not in May. `shutMonths` are the months it does
// not run -- but only among the months its dates speak for. Many operators have
// published summer dates and not yet winter ones (`knownMonths`, May to
// November); a winter month is then not known, not shut. A walk that needs a
// lift is out of season in its shut months (trail-season-words.js).

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function dayOfYear(md){
  const [month, day] = md.split('-').map(Number);
  return MONTH_DAYS.slice(0, month - 1).reduce((sum, days) => sum + days, 0) + day;
}

/** The days of the year (1-365) a lift runs, from its periods; a period may cross New Year. */
function runningDays(periods){
  const days = new Set();
  for(const { from, to } of periods){
    const start = dayOfYear(from), end = dayOfYear(to);
    if(start <= end) for(let d = start; d <= end; d += 1) days.add(d);
    else { for(let d = start; d <= 365; d += 1) days.add(d); for(let d = 1; d <= end; d += 1) days.add(d); }
  }
  return days;
}

/** The months (1-12) a lift runs for at least half of. */
function runningMonths(periods){
  const days = runningDays(periods);
  const months = [];
  let first = 1;
  MONTH_DAYS.forEach((length, i) => {
    let open = 0;
    for(let d = first; d < first + length; d += 1) if(days.has(d)) open += 1;
    if(open * 2 >= length) months.push(i + 1);
    first += length;
  });
  return months;
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The months, among those its dates speak for, that a lift does not run. */
function shutMonths(lift){
  const running = new Set(runningMonths(lift.periods));
  return (lift.knownMonths || ALL_MONTHS).filter(m => !running.has(m)).sort((a, b) => a - b);
}

function validateLift(id, lift){
  if(!lift || typeof lift.name !== 'string' || !lift.name.trim()) throw new Error(`Lift ${id} has no name`);
  if(!Array.isArray(lift.periods) || !lift.periods.length) throw new Error(`Lift ${id} has no running periods`);
  for(const period of lift.periods){
    if(!MD.test(period.from || '') || !MD.test(period.to || '')) throw new Error(`Lift ${id} has a period that is not MM-DD to MM-DD`);
  }
  if(!/^https:\/\//.test(lift.url || '')) throw new Error(`Lift ${id} has no source url`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(lift.accessedAt || '')) throw new Error(`Lift ${id} has no read-on date`);
  if(!lift.datesFor) throw new Error(`Lift ${id} does not say which year its dates are`);
  if(lift.knownMonths !== undefined && !(Array.isArray(lift.knownMonths) && lift.knownMonths.every(m => Number.isInteger(m) && m >= 1 && m <= 12))){
    throw new Error(`Lift ${id} has bad knownMonths`);
  }
  for(const key of ['valleyM', 'topM']){
    if(lift[key] !== undefined && !(Number.isFinite(lift[key]) && lift[key] > 0)) throw new Error(`Lift ${id} has a bad ${key}`);
  }
}

function applyLiftSeasons(trails, artifact){
  const lifts = (artifact && artifact.lifts) || {};
  const uses = (artifact && artifact.trails) || {};
  Object.entries(lifts).forEach(([id, lift]) => validateLift(id, lift));
  const known = new Set(trails.map(trail => trail.id));
  for(const [trailId, use] of Object.entries(uses)){
    if(!known.has(trailId)) throw new Error(`Lift seasons name an unknown walk: ${trailId}`);
    for(const liftId of use.lifts || []) if(!lifts[liftId]) throw new Error(`Lift seasons for ${trailId} name an unknown lift: ${liftId}`);
  }
  return trails.map(trail => {
    const use = uses[trail.id];
    if(!use || !trail.season) return trail;
    // Required follows the walk's lift record: a walk that only offers a lift
    // as a shortcut is still a walk when the lift is shut.
    const required = !!(trail.liftAccess && trail.liftAccess.dependency === 'required');
    const records = use.lifts.map(liftId => {
      const lift = lifts[liftId];
      const record = {
        id: liftId, name: lift.name, required,
        periods: lift.periods.map(({ from, to }) => ({ from, to })),
        shutMonths: shutMonths(lift),
        ...(lift.knownMonths && lift.knownMonths.length < 12 ? { summerOnly: true } : {}),
        datesFor: lift.datesFor, operator: lift.operator || '', url: lift.url, accessedAt: lift.accessedAt,
      };
      if(lift.valleyM && lift.topM && lift.topM > lift.valleyM) record.climbM = Math.round((lift.topM - lift.valleyM) / 10) * 10;
      return record;
    });
    return { ...trail, season: { ...trail.season, lifts: records } };
  });
}

module.exports = { applyLiftSeasons, runningMonths, runningDays, shutMonths, validateLift };
