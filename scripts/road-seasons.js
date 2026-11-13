'use strict';

// Roads that close for the winter and are the only drive to a walk's start,
// from data/road-seasons.json. Each walk that needs one gets it in
// trail.season.roads:
//
//   { id, name, usually: { from: {part, month}, to: {part, month} },
//     shutMonths, operator, url, accessedAt }
//
// A road is shut in the months it is not open for most of (openMonths): one
// that opens in late May is shut in May. A walk that needs the road is out of
// season in its shut months (trail-season-words.js).
//
// Access rules are roads that stay open but limit cars for part of the year
// (a summer booking, a winter toll with time windows). They never change a
// walk's months: the walk gets the rule in trail.season.access,
//
//   { id, line, monthNote, months, operator, url, accessedAt }
//
// and the page says it, and in its months the monthly note does.

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const PARTS = new Set(['early', 'mid', 'late']);
const isMonth = m => Number.isInteger(m) && m >= 1 && m <= 12;

function validateRoad(id, road){
  if(!road || typeof road.name !== 'string' || !road.name.trim()) throw new Error(`Road ${id} has no name`);
  if(!Array.isArray(road.openMonths) || !road.openMonths.length || !road.openMonths.every(isMonth)) throw new Error(`Road ${id} has bad openMonths`);
  for(const end of ['from', 'to']){
    const point = road.usually && road.usually[end];
    if(!point || !PARTS.has(point.part) || !isMonth(point.month)) throw new Error(`Road ${id} does not say when it usually ${end === 'from' ? 'opens' : 'shuts'}`);
  }
  if(!/^https:\/\//.test(road.url || '')) throw new Error(`Road ${id} has no source url`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(road.accessedAt || '')) throw new Error(`Road ${id} has no read-on date`);
}

function validateAccess(id, rule){
  if(!rule || typeof rule.line !== 'string' || !rule.line.trim()) throw new Error(`Access rule ${id} has no line`);
  if(typeof rule.monthNote !== 'string' || !rule.monthNote.includes('{month}')) throw new Error(`Access rule ${id} has no month note`);
  if(!Array.isArray(rule.months) || !rule.months.length || !rule.months.every(isMonth)) throw new Error(`Access rule ${id} has bad months`);
  if(!/^https:\/\//.test(rule.url || '')) throw new Error(`Access rule ${id} has no source url`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(rule.accessedAt || '')) throw new Error(`Access rule ${id} has no read-on date`);
}

function applyRoadSeasons(trails, artifact){
  const roads = (artifact && artifact.roads) || {};
  const access = (artifact && artifact.access) || {};
  Object.entries(access).forEach(([id, rule]) => validateAccess(id, rule));
  const uses = (artifact && artifact.trails) || {};
  Object.entries(roads).forEach(([id, road]) => validateRoad(id, road));
  const known = new Set(trails.map(trail => trail.id));
  for(const [trailId, use] of Object.entries(uses)){
    if(!known.has(trailId)) throw new Error(`Road seasons name an unknown walk: ${trailId}`);
    for(const roadId of use.roads || []) if(!roads[roadId]) throw new Error(`Road seasons for ${trailId} name an unknown road: ${roadId}`);
    for(const ruleId of use.access || []) if(!access[ruleId]) throw new Error(`Road seasons for ${trailId} name an unknown access rule: ${ruleId}`);
  }
  return trails.map(trail => {
    const use = uses[trail.id];
    if(!use || !trail.season) return trail;
    const season = { ...trail.season };
    if((use.access || []).length){
      season.access = use.access.map(ruleId => {
        const rule = access[ruleId];
        return { id: ruleId, line: rule.line, monthNote: rule.monthNote, months: rule.months.slice().sort((a, b) => a - b), operator: rule.operator || '', url: rule.url, accessedAt: rule.accessedAt };
      });
    }
    if(!(use.roads || []).length) return { ...trail, season };
    const records = use.roads.map(roadId => {
      const road = roads[roadId];
      const open = new Set(road.openMonths);
      return {
        id: roadId, name: road.name,
        usually: { from: { ...road.usually.from }, to: { ...road.usually.to } },
        shutMonths: ALL_MONTHS.filter(m => !open.has(m)),
        operator: road.operator || '', url: road.url, accessedAt: road.accessedAt,
      };
    });
    return { ...trail, season: { ...season, roads: records } };
  });
}

module.exports = { applyRoadSeasons, validateRoad, validateAccess };
