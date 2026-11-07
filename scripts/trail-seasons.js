'use strict';

// When in the year a walk is a walk, per trail, written to data/trail-seasons.json
// by scripts/build-trail-seasons.js. Three kinds of answer, and the reader is
// told which one they have:
//
//   recommended  the months the walk's own tourist board marks as its season,
//                read off the board's page (sourced);
//   snow         where no board publishes months, an estimate of the snowy
//                months from the walk's high point, said to be an estimate;
//   winterUse    the stretches of the line that are mapped as a ski run, a sled
//                run or a cross-country track, read off the map (OpenStreetMap).
//
// A walk carries recommended or snow, never both: two answers to one question
// would leave the reader to pick. winterUse sits beside either, since a summer
// path that becomes a piste is a fact about winter, not about the season.

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WINTER_USE_KINDS = ['downhill', 'sled', 'nordic'];
// A stretch shorter than this is a crossing, not a walk along a piste: of the
// Dolomites walks, those under half a kilometre almost all cut across a run.
const WINTER_USE_MIN_KM = 0.5;

// Snow by the walk's highest point. A rule of thumb for the Dolomites, not a
// forecast, and the page says so: it is what the line's altitude suggests when
// nobody has published the walk's season.
const SNOW_BANDS = [
  { minAlt: 2000, months: [11, 12, 1, 2, 3, 4, 5], likelihood: 'likely' },
  { minAlt: 1600, months: [12, 1, 2, 3, 4], likelihood: 'likely' },
  { minAlt: -Infinity, months: [12, 1, 2], likelihood: 'possible' },
];

function snowEstimate(highPoint){
  if(!Number.isFinite(highPoint) || highPoint <= 0) return null;
  const band = SNOW_BANDS.find(entry => highPoint >= entry.minAlt);
  return { months: band.months.slice().sort((a, b) => a - b), likelihood: band.likelihood, highPoint: Math.round(highPoint) };
}

const ARIA_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// The month grids the boards print. Outdooractive and the sites built on it
// mark a recommended month "month tip"; Alta Badia marks it "month active"; the
// Dreizinnen, Eggental, Olang and Antholz sites list the recommended months in
// the grid's aria-label. A page with no grid, or a grid that is not twelve
// months, answers nothing.
function parseBoardMonths(html){
  const text = String(html || '');
  const aria = text.match(/seasons-bar"\s+aria-label="aria\.suggested_months_period\.prefix:\s*([^"]+)"/);
  if(aria){
    const months = [...aria[1].matchAll(/aria\.month\.([a-z]{3})/g)].map(m => ARIA_MONTHS[m[1]]).filter(Boolean);
    return months.length ? [...new Set(months)].sort((a, b) => a - b) : null;
  }
  const cells = [...text.matchAll(/class="month( tip| active)?"/g)].slice(0, 12);
  if(cells.length !== 12) return null;
  const months = cells.map((cell, index) => (cell[1] ? index + 1 : null)).filter(Boolean);
  return months.length ? months : null;
}

function validMonths(months){
  return Array.isArray(months) && months.length > 0 && months.length <= 12
    && months.every((m, i) => MONTHS.includes(m) && (i === 0 || m > months[i - 1]));
}

function validateSeason(id, season){
  if(!season || typeof season !== 'object') throw new Error(`Season for ${id} must be a record`);
  if(season.recommended && season.snow) throw new Error(`Season for ${id} carries both board months and a snow estimate`);
  if(season.recommended){
    const { months, source } = season.recommended;
    if(!validMonths(months)) throw new Error(`Season for ${id} has invalid recommended months`);
    if(!source || typeof source.label !== 'string' || !/^https:\/\//.test(source.url || '') || typeof source.accessedAt !== 'string'){
      throw new Error(`Season for ${id} names no source for its recommended months`);
    }
  }
  if(season.snow){
    if(!validMonths(season.snow.months)) throw new Error(`Season for ${id} has invalid snow months`);
    if(!['likely', 'possible'].includes(season.snow.likelihood)) throw new Error(`Season for ${id} has an unknown snow likelihood`);
    if(!Number.isFinite(season.snow.highPoint)) throw new Error(`Season for ${id} has a snow estimate without a high point`);
  }
  for(const use of season.winterUse || []){
    if(!WINTER_USE_KINDS.includes(use.kind)) throw new Error(`Season for ${id} has an unknown winter use: ${use.kind}`);
    if(!Number.isFinite(use.km) || use.km < WINTER_USE_MIN_KM) throw new Error(`Season for ${id} has a winter use under ${WINTER_USE_MIN_KM} km`);
    if(!Array.isArray(use.names)) throw new Error(`Season for ${id} has a winter use without names`);
  }
}

function applyTrailSeasons(trails, artifact){
  const entries = artifact && artifact.trails ? artifact.trails : {};
  const known = new Set(trails.map(trail => trail.id));
  for(const id of Object.keys(entries)){
    if(!known.has(id)) throw new Error(`Season entry targets an unknown trail: ${id}`);
    validateSeason(id, entries[id]);
  }
  const winterUseSource = artifact && artifact.sources && artifact.sources.winterUse;
  return trails.map(trail => {
    const season = entries[trail.id];
    if(!season) return trail;
    const record = {};
    if(season.recommended) record.recommended = season.recommended;
    if(season.snow) record.snow = season.snow;
    if(season.winterUse && season.winterUse.length){
      record.winterUse = season.winterUse;
      if(winterUseSource) record.winterUseSource = winterUseSource;
    }
    return { ...trail, season: record };
  });
}

module.exports = {
  MONTHS,
  WINTER_USE_KINDS,
  WINTER_USE_MIN_KM,
  SNOW_BANDS,
  snowEstimate,
  parseBoardMonths,
  validateSeason,
  applyTrailSeasons,
};
