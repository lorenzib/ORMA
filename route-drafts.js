(function(root){
  'use strict';

  const STORAGE_KEY = 'orma-custom-loops-v1';
  const LIMIT = 20;

  function validPoint(point){
    return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
  }

  // A route needs two chosen points and a path between them. How many points
  // a given shape needs to finish (three for a loop, two for point-to-point
  // and out-and-back) is the planner's rule, not the store's: keeping a
  // loop-era minimum here silently refused every two-point open route.
  const MIN_POINTS = 2;

  function normalize(record){
    if(!record || typeof record !== 'object' || !record.id ||
       !Array.isArray(record.points) || record.points.length < MIN_POINTS ||
       !Array.isArray(record.path) || record.path.length < 2) return null;
    const points = record.points.map(point => ({ lat:Number(point.lat), lng:Number(point.lng) }));
    const path = record.path.map(point => Array.isArray(point)
      ? [Number(point[0]), Number(point[1])]
      : [Number(point.lat), Number(point.lng)]);
    if(points.some(point => !validPoint(point)) ||
       path.some(point => !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) return null;
    return {
      id:String(record.id),
      name:String(record.name || 'Draft loop'),
      createdAt:String(record.createdAt || new Date().toISOString()),
      updatedAt:String(record.updatedAt || record.createdAt || new Date().toISOString()),
      graphUrl:String(record.graphUrl || ''),
      coverageId:String(record.coverageId || record.sourceTrailId || ''),
      source:String(record.source || 'openstreetmap'),
      distanceM:Number.isFinite(Number(record.distanceM)) ? Math.round(Number(record.distanceM)) : 0,
      // The planner reopens a draft in its own shape and with its climb; both
      // were dropped here, so every reopened draft came back a loop with no
      // ascent.
      shape:['loop', 'point-to-point', 'out-and-back'].includes(record.shape) ? record.shape : 'loop',
      ascentM:Number.isFinite(Number(record.ascentM)) && record.ascentM !== null ? Math.round(Number(record.ascentM)) : null,
      // An adjusted walk: which ORMA walk it started from, and how much of it
      // still follows that walk's checked line.
      basedOn:record.basedOn && record.basedOn.id
        ? { id:String(record.basedOn.id), name:String(record.basedOn.name || '') }
        : null,
      onLineShare:Number.isFinite(Number(record.onLineShare)) && record.onLineShare !== null
        ? Math.max(0, Math.min(1, Number(record.onLineShare))) : null,
      heights:Array.isArray(record.heights) && record.heights.length === path.length
        && record.heights.every(value => Number.isFinite(Number(value)))
        ? record.heights.map(value => Math.round(Number(value))) : null,
      points,
      path,
    };
  }

  function read(storage){
    storage = storage || root.localStorage;
    try{
      const records = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(records) ? records.map(normalize).filter(Boolean) : [];
    }catch(error){ return []; }
  }

  function write(records, storage){
    storage = storage || root.localStorage;
    storage.setItem(STORAGE_KEY, JSON.stringify(records.map(normalize).filter(Boolean).slice(0, LIMIT)));
  }

  function save(record, storage){
    const normalized = normalize(record);
    if(!normalized) return null;
    const records = read(storage).filter(item => item.id !== normalized.id);
    write([normalized, ...records], storage);
    return normalized;
  }

  function remove(id, storage){
    const records = read(storage);
    const next = records.filter(record => record.id !== String(id));
    write(next, storage);
    return next.length !== records.length;
  }

  function find(id, storage){
    return read(storage).find(record => record.id === String(id)) || null;
  }

  root.DoloPawsRouteDrafts = Object.freeze({ STORAGE_KEY, read, save, remove, find });
})(typeof window !== 'undefined' ? window : globalThis);
