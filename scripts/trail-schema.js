'use strict';

const TOP_LEVEL_FIELDS = [
  'schemaVersion', 'recordVersion', 'id', 'slug', 'origin', 'lifecycle',
  'name', 'region', 'geometry', 'center', 'trailhead', 'metrics',
  'suitability', 'waypoints', 'content', 'sources', 'verification',
  'freshness', 'provenance', 'unknownFields',
];
const UNKNOWN_ROOTS = new Set([
  'metrics', 'trailhead', 'suitability', 'waypoints', 'content', 'sources',
  'verification', 'freshness', 'provenance',
]);
const ENUMS = {
  origin: ['curated', 'osm'],
  lifecycle: ['draft', 'published', 'retired'],
  routeType: ['loop', 'out-and-back', 'point-to-point', 'unknown'],
  difficulty: ['easy', 'moderate', 'hard', 'expert', 'unknown'],
  safetyLevel: ['low-risk', 'moderate', 'caution', 'unknown'],
  heatRisk: ['low', 'moderate', 'high', 'unknown'],
  dogAccess: ['allowed', 'leash-required', 'seasonal-restrictions', 'prohibited', 'unknown'],
  reviewTier: ['imported', 'mapped', 'route-audited', 'field-verified'],
  reviewStatus: ['unreviewed', 'in-progress', 'verified'],
  reviewState: ['verified', 'unreviewed', 'unknown'],
  trailheadStatus: ['reviewed', 'mapped-suggestion', 'unknown'],
  waypointStatus: ['reviewed', 'mapped', 'unknown'],
  waypointType: ['water', 'parking', 'trailhead', 'shelter', 'hazard', 'emergency-exit', 'other'],
  sourceKind: ['official', 'osm', 'field-review', 'computed', 'legacy', 'other'],
};
const REVIEW_CATEGORIES = [
  'route', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access',
];

function isObject(value){
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, path, message){
  errors.push(`${path}: ${message}`);
}

function checkEnum(errors, path, value, values){
  if(!values.includes(value)) add(errors, path, `expected one of ${values.join(', ')}`);
}

function checkString(errors, path, value, allowNull){
  if(value === null && allowNull) return;
  if(typeof value !== 'string' || !value.trim()) add(errors, path, 'expected a non-empty string');
}

function checkDate(errors, path, value, allowNull){
  if(value === null && allowNull) return;
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))){
    add(errors, path, 'expected an ISO YYYY-MM-DD date');
  }
}

function checkNullableNumber(errors, path, value, options = {}){
  if(value === null) return;
  if(typeof value !== 'number' || !Number.isFinite(value)){
    add(errors, path, 'expected a finite number or null');
    return;
  }
  if(options.min !== undefined && value < options.min) add(errors, path, `must be at least ${options.min}`);
  if(options.max !== undefined && value > options.max) add(errors, path, `must be no more than ${options.max}`);
}

function checkPosition(errors, path, value, allowNull){
  if(value === null && allowNull) return;
  if(!Array.isArray(value) || value.length !== 2){
    add(errors, path, 'expected [longitude, latitude]');
    return;
  }
  const [lng, lat] = value;
  if(!Number.isFinite(lng) || lng < -180 || lng > 180) add(errors, `${path}/0`, 'invalid longitude');
  if(!Number.isFinite(lat) || lat < -90 || lat > 90) add(errors, `${path}/1`, 'invalid latitude');
}

function pointerValue(record, pointer){
  return pointer.split('/').slice(1).reduce((value, key) => {
    if(value === undefined || value === null) return undefined;
    return value[key.replace(/~1/g, '/').replace(/~0/g, '~')];
  }, record);
}

function collectUnknowns(value, path, found){
  if(value === null || value === 'unknown'){
    const root = path.split('/')[1];
    if(UNKNOWN_ROOTS.has(root)) found.push(path);
    return;
  }
  if(Array.isArray(value)){
    value.forEach((item, index) => collectUnknowns(item, `${path}/${index}`, found));
  }else if(isObject(value)){
    Object.entries(value).forEach(([key, item]) => collectUnknowns(item, `${path}/${key}`, found));
  }
}

function validateTrailRecord(record){
  const errors = [];
  if(!isObject(record)) return ['/: expected an object'];

  for(const field of TOP_LEVEL_FIELDS){
    if(!(field in record)) add(errors, '/', `missing required field ${field}`);
  }
  for(const field of Object.keys(record)){
    if(!TOP_LEVEL_FIELDS.includes(field)) add(errors, `/${field}`, 'unknown top-level field');
  }
  if(errors.some(error => error.startsWith('/: missing'))) return errors;

  if(record.schemaVersion !== '1.0.0') add(errors, '/schemaVersion', 'expected 1.0.0');
  if(!Number.isInteger(record.recordVersion) || record.recordVersion < 1) add(errors, '/recordVersion', 'expected a positive integer');
  if(typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(record.id)) add(errors, '/id', 'invalid canonical ID');
  if(typeof record.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,99}$/.test(record.slug)) add(errors, '/slug', 'invalid slug');
  checkEnum(errors, '/origin', record.origin, ENUMS.origin);
  checkEnum(errors, '/lifecycle', record.lifecycle, ENUMS.lifecycle);
  checkString(errors, '/name', record.name, false);

  if(!isObject(record.region)) add(errors, '/region', 'expected an object');
  else{
    checkString(errors, '/region/id', record.region.id, false);
    checkString(errors, '/region/name', record.region.name, false);
    if(typeof record.region.countryCode !== 'string' || !/^[A-Z]{2}$/.test(record.region.countryCode)){
      add(errors, '/region/countryCode', 'expected an ISO 3166-1 alpha-2 code');
    }
  }

  if(!isObject(record.geometry) || !['LineString', 'MultiLineString'].includes(record.geometry.type)){
    add(errors, '/geometry', 'expected a GeoJSON LineString or MultiLineString');
  }else{
    const lines = record.geometry.type === 'LineString' ? [record.geometry.coordinates] : record.geometry.coordinates;
    if(!Array.isArray(lines) || !lines.length) add(errors, '/geometry/coordinates', 'expected at least one line');
    else lines.forEach((line, lineIndex) => {
      const base = record.geometry.type === 'LineString' ? '/geometry/coordinates' : `/geometry/coordinates/${lineIndex}`;
      if(!Array.isArray(line) || line.length < 2) add(errors, base, 'expected at least two positions');
      else line.forEach((position, index) => checkPosition(errors, `${base}/${index}`, position, false));
    });
    if(record.metrics && record.metrics.routeType === 'loop' && record.geometry.type === 'LineString'){
      const points = record.geometry.coordinates;
      if(Array.isArray(points) && points.length > 1 && JSON.stringify(points[0]) !== JSON.stringify(points[points.length - 1])){
        add(errors, '/geometry/coordinates', 'loop geometry must be closed');
      }
    }
  }
  checkPosition(errors, '/center', record.center, false);

  if(!isObject(record.trailhead)) add(errors, '/trailhead', 'expected an object');
  else{
    checkPosition(errors, '/trailhead/position', record.trailhead.position, true);
    if(record.trailhead.label !== null) checkString(errors, '/trailhead/label', record.trailhead.label, false);
    checkEnum(errors, '/trailhead/status', record.trailhead.status, ENUMS.trailheadStatus);
  }

  if(!isObject(record.metrics)) add(errors, '/metrics', 'expected an object');
  else{
    checkNullableNumber(errors, '/metrics/distanceKm', record.metrics.distanceKm, { min: 0, max: 1000 });
    checkNullableNumber(errors, '/metrics/ascentM', record.metrics.ascentM, { min: 0, max: 20000 });
    checkNullableNumber(errors, '/metrics/descentM', record.metrics.descentM, { min: 0, max: 20000 });
    checkNullableNumber(errors, '/metrics/durationMinutes', record.metrics.durationMinutes, { min: 0, max: 100000 });
    checkNullableNumber(errors, '/metrics/minElevationM', record.metrics.minElevationM, { min: -500, max: 9000 });
    checkNullableNumber(errors, '/metrics/maxElevationM', record.metrics.maxElevationM, { min: -500, max: 9000 });
    checkEnum(errors, '/metrics/routeType', record.metrics.routeType, ENUMS.routeType);
    checkEnum(errors, '/metrics/difficulty', record.metrics.difficulty, ENUMS.difficulty);
    if(record.metrics.minElevationM !== null && record.metrics.maxElevationM !== null &&
       record.metrics.minElevationM > record.metrics.maxElevationM){
      add(errors, '/metrics', 'minimum elevation exceeds maximum elevation');
    }
  }

  if(!isObject(record.suitability)) add(errors, '/suitability', 'expected an object');
  else{
    checkEnum(errors, '/suitability/safetyLevel', record.suitability.safetyLevel, ENUMS.safetyLevel);
    checkNullableNumber(errors, '/suitability/terrainRank', record.suitability.terrainRank, { min: 0, max: 3 });
    checkNullableNumber(errors, '/suitability/shadePercent', record.suitability.shadePercent, { min: 0, max: 100 });
    checkEnum(errors, '/suitability/heatRisk', record.suitability.heatRisk, ENUMS.heatRisk);
    if(record.suitability.exposure !== null && typeof record.suitability.exposure !== 'boolean'){
      add(errors, '/suitability/exposure', 'expected boolean or null');
    }
    if(!Array.isArray(record.suitability.surfaceHazards)) add(errors, '/suitability/surfaceHazards', 'expected an array');
    if(!isObject(record.suitability.dogAccess)) add(errors, '/suitability/dogAccess', 'expected an object');
    else{
      checkEnum(errors, '/suitability/dogAccess/status', record.suitability.dogAccess.status, ENUMS.dogAccess);
      if(record.suitability.dogAccess.notes !== null) checkString(errors, '/suitability/dogAccess/notes', record.suitability.dogAccess.notes, false);
    }
  }

  if(!Array.isArray(record.waypoints)) add(errors, '/waypoints', 'expected an array');
  else record.waypoints.forEach((waypoint, index) => {
    const base = `/waypoints/${index}`;
    if(!isObject(waypoint)){ add(errors, base, 'expected an object'); return; }
    checkString(errors, `${base}/id`, waypoint.id, false);
    checkEnum(errors, `${base}/type`, waypoint.type, ENUMS.waypointType);
    checkString(errors, `${base}/name`, waypoint.name, false);
    checkPosition(errors, `${base}/position`, waypoint.position, false);
    checkNullableNumber(errors, `${base}/distanceKm`, waypoint.distanceKm, { min: 0, max: 1000 });
    checkEnum(errors, `${base}/status`, waypoint.status, ENUMS.waypointStatus);
    if(waypoint.seasonal !== null && typeof waypoint.seasonal !== 'boolean') add(errors, `${base}/seasonal`, 'expected boolean or null');
  });

  if(!isObject(record.content)) add(errors, '/content', 'expected an object');
  else{
    if(record.content.summary !== null) checkString(errors, '/content/summary', record.content.summary, false);
    if(record.content.tips !== null) checkString(errors, '/content/tips', record.content.tips, false);
  }

  if(!Array.isArray(record.sources) || !record.sources.length) add(errors, '/sources', 'expected at least one source');
  else record.sources.forEach((source, index) => {
    const base = `/sources/${index}`;
    if(!isObject(source)){ add(errors, base, 'expected an object'); return; }
    checkString(errors, `${base}/id`, source.id, false);
    checkString(errors, `${base}/label`, source.label, false);
    if(source.url !== null){
      try{ new URL(source.url); }catch(error){ add(errors, `${base}/url`, 'expected an absolute URL or null'); }
    }
    checkString(errors, `${base}/provider`, source.provider, false);
    checkEnum(errors, `${base}/kind`, source.kind, ENUMS.sourceKind);
    checkDate(errors, `${base}/retrievedAt`, source.retrievedAt, true);
    checkDate(errors, `${base}/observedAt`, source.observedAt, true);
    if(!Array.isArray(source.categories)) add(errors, `${base}/categories`, 'expected an array');
    if(source.licence !== null) checkString(errors, `${base}/licence`, source.licence, false);
  });

  if(!isObject(record.verification)) add(errors, '/verification', 'expected an object');
  else{
    checkEnum(errors, '/verification/tier', record.verification.tier, ENUMS.reviewTier);
    checkEnum(errors, '/verification/status', record.verification.status, ENUMS.reviewStatus);
    checkDate(errors, '/verification/reviewedAt', record.verification.reviewedAt, true);
    if(record.verification.reviewedBy !== null) checkString(errors, '/verification/reviewedBy', record.verification.reviewedBy, false);
    if(!isObject(record.verification.categories)) add(errors, '/verification/categories', 'expected an object');
    else REVIEW_CATEGORIES.forEach(category =>
      checkEnum(errors, `/verification/categories/${category}`, record.verification.categories[category], ENUMS.reviewState)
    );
    if(record.verification.status === 'verified' &&
       (!record.verification.reviewedAt || !record.verification.reviewedBy ||
        REVIEW_CATEGORIES.some(category => record.verification.categories[category] !== 'verified'))){
      add(errors, '/verification', 'verified records require a reviewer, date, and every category verified');
    }
    if(record.verification.tier === 'field-verified' && record.verification.status !== 'verified'){
      add(errors, '/verification/tier', 'field-verified tier requires verified status');
    }
  }

  if(!isObject(record.freshness)) add(errors, '/freshness', 'expected an object');
  else ['geometryAt', 'safetyAt', 'accessAt'].forEach(field =>
    checkDate(errors, `/freshness/${field}`, record.freshness[field], true)
  );

  if(!isObject(record.provenance)) add(errors, '/provenance', 'expected an object');
  else{
    if(record.provenance.externalId !== null) checkString(errors, '/provenance/externalId', record.provenance.externalId, false);
    checkDate(errors, '/provenance/generatedAt', record.provenance.generatedAt, true);
    if(record.provenance.generatorVersion !== null) checkString(errors, '/provenance/generatorVersion', record.provenance.generatorVersion, false);
    if(record.origin === 'osm' && !record.provenance.externalId) add(errors, '/provenance/externalId', 'OSM records require an external ID');
  }

  if(!Array.isArray(record.unknownFields)) add(errors, '/unknownFields', 'expected an array');
  else{
    const declared = new Set(record.unknownFields);
    if(declared.size !== record.unknownFields.length) add(errors, '/unknownFields', 'contains duplicates');
    for(const pointer of declared){
      if(typeof pointer !== 'string' || !pointer.startsWith('/')){
        add(errors, '/unknownFields', 'every entry must be a JSON pointer');
        continue;
      }
      const value = pointerValue(record, pointer);
      if(value !== null && value !== 'unknown') add(errors, pointer, 'declared unknown must resolve to null or "unknown"');
    }
    const actual = [];
    TOP_LEVEL_FIELDS.forEach(field => collectUnknowns(record[field], `/${field}`, actual));
    actual.forEach(pointer => {
      if(!declared.has(pointer)) add(errors, pointer, 'unknown value is not declared in unknownFields');
    });
  }

  return errors;
}

module.exports = {
  ENUMS,
  REVIEW_CATEGORIES,
  validateTrailRecord,
};
