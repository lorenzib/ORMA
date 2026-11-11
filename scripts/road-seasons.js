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

function applyRoadSeasons(trails, artifact){
  const roads = (artifact && artifact.roads) || {};
  const uses = (artifact && artifact.trails) || {};
  Object.entries(roads).forEach(([id, road]) => validateRoad(id, road));
  const known = new Set(trails.map(trail => trail.id));
  for(const [trailId, use] of Object.entries(uses)){
    if(!known.has(trailId)) throw new Error(`Road seasons name an unknown walk: ${trailId}`);
    for(const roadId of use.roads || []) if(!roads[roadId]) throw new Error(`Road seasons for ${trailId} name an unknown road: ${roadId}`);
  }
  return trails.map(trail => {
    const use = uses[trail.id];
    if(!use || !trail.season) return trail;
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
    return { ...trail, season: { ...trail.season, roads: records } };
  });
}

module.exports = { applyRoadSeasons, validateRoad };
