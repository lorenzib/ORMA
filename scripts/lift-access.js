'use strict';

// Lift access per trail, curated in data/lift-access.json. The catalogue's
// lift records (trails-data.js gondolas) know where 877 lifts run and which
// are open chairlifts, but not whether a route rides one: eight routes start
// or end within 200 m of a chairlift station and nearly all of those are the
// valley station beside a car park. So dependency is a human statement, made
// here, and the engine treats an open chairlift a route depends on as a hard
// stop for every dog except one declared safe on chairlifts and small enough
// to be held.

const LIFT_TYPES = ['none', 'gondola', 'chairlift', 'mixed', 'unknown'];
const LIFT_DEPENDENCIES = ['none', 'optional', 'required'];

function normalizeLiftAccess(value){
  if(!value || typeof value !== 'object') return { type:'none', dependency:'none' };
  const type = LIFT_TYPES.includes(value.type) ? value.type : 'unknown';
  const dependency = LIFT_DEPENDENCIES.includes(value.dependency) ? value.dependency : 'none';
  // Name and notes are present only when known: a null here would have to be
  // declared in the record's unknownFields, and an absent lift name is not an
  // unknown fact, just an unnamed lift.
  const record = { type: type === 'none' ? 'none' : type, dependency: type === 'none' ? 'none' : dependency };
  if(typeof value.name === 'string' && value.name.trim()) record.name = value.name.trim();
  if(typeof value.notes === 'string' && value.notes.trim()) record.notes = value.notes.trim();
  return record;
}

function applyLiftAccess(trails, artifact){
  const next = trails.map(trail => ({ ...trail }));
  const knownIds = new Set(next.map(trail => trail.id));
  for(const entry of artifact?.trails || []){
    if(!entry || typeof entry.id !== 'string' || !entry.fields || typeof entry.fields.liftAccess !== 'object'){
      throw new Error('Lift access entry must carry an id and a liftAccess record');
    }
    if(!knownIds.has(entry.id)) throw new Error(`Lift access entry targets an unknown trail: ${entry.id}`);
    const lift = entry.fields.liftAccess;
    if(!LIFT_TYPES.includes(lift.type)) throw new Error(`Lift access for ${entry.id} has an unknown type: ${lift.type}`);
    if(!LIFT_DEPENDENCIES.includes(lift.dependency)) throw new Error(`Lift access for ${entry.id} has an unknown dependency: ${lift.dependency}`);
    if(lift.dependency === 'required' && lift.type === 'none') throw new Error(`Lift access for ${entry.id} cannot require no lift`);
    const index = next.findIndex(trail => trail.id === entry.id);
    next[index] = { ...next[index], liftAccess: normalizeLiftAccess(lift), id: entry.id };
  }
  return next;
}

module.exports = { LIFT_TYPES, LIFT_DEPENDENCIES, normalizeLiftAccess, applyLiftAccess };
