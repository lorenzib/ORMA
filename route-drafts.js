(function(root){
  'use strict';

  const STORAGE_KEY = 'orma-custom-loops-v1';
  const LIMIT = 20;

  function validPoint(point){
    return point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));
  }

  function normalize(record){
    if(!record || typeof record !== 'object' || !record.id ||
       !Array.isArray(record.points) || record.points.length < 3 ||
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
