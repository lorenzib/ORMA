'use strict';

const { validateTrailRecord, REVIEW_CATEGORIES } = require('./trail-schema');
const evidence = require('../trust/evidence-v1.js');

const ADAPTER_VERSION = '1.0.0';
const UNKNOWN_ROOTS = new Set([
  'metrics', 'trailhead', 'suitability', 'waypoints', 'content', 'sources',
  'verification', 'freshness', 'provenance',
]);
const SOURCE_CATEGORIES = new Set([
  'route', 'metrics', 'water', 'heat', 'exposure', 'livestock',
  'surfaceHazards', 'access', 'content',
]);
const GRADUATION_CATEGORIES = new Set([
  'photo', 'route', 'mapPoints', 'elevation', ...REVIEW_CATEGORIES,
]);

function slugify(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function finite(value){
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isoDate(value){
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    ? value : null;
}

function haversineKm(a, b){
  const radians = degrees => degrees * Math.PI / 180;
  const lat1 = radians(a[0]);
  const lat2 = radians(b[0]);
  const dLat = lat2 - lat1;
  const dLng = radians(b[1] - a[1]);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(value));
}

function geometryStats(path){
  let distanceKm = 0;
  let maximumSegmentKm = 0;
  let maximumSegmentIndex = null;
  if(!Array.isArray(path)) return { distanceKm, maximumSegmentKm, maximumSegmentIndex };
  for(let index = 1; index < path.length; index += 1){
    if(!Array.isArray(path[index - 1]) || !Array.isArray(path[index])) continue;
    const segment = haversineKm(path[index - 1], path[index]);
    distanceKm += segment;
    if(segment > maximumSegmentKm){
      maximumSegmentKm = segment;
      maximumSegmentIndex = index;
    }
  }
  return { distanceKm, maximumSegmentKm, maximumSegmentIndex };
}

function parseDurationMinutes(value){
  if(finite(value) !== null) return Math.round(value * 60);
  if(typeof value !== 'string') return null;
  const normalized = value.replace(/,/g, '.').replace(/[–—]/g, '-');
  const clock = normalized.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
  if(clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const numbers = normalized.match(/\d+(?:\.\d+)?/g);
  if(!numbers || !numbers.length) return null;
  const hours = numbers.length >= 2
    ? (Number(numbers[0]) + Number(numbers[1])) / 2
    : Number(numbers[0]);
  return Number.isFinite(hours) ? Math.round(hours * 60) : null;
}

function routeType(legacy, stats){
  const path = legacy.path;
  if(Array.isArray(path) && path.length >= 2
    && JSON.stringify(path[0]) === JSON.stringify(path[path.length - 1])){
    return 'loop';
  }
  const declared = finite(legacy.distance);
  if(declared && stats.distanceKm / declared >= 0.4 && stats.distanceKm / declared <= 0.6){
    return 'out-and-back';
  }
  return 'unknown';
}

function regionFor(legacy){
  const region = legacy.region === 'savoy'
    ? { id: 'savoy', name: 'Savoy', countryCode: 'FR' }
    : { id: 'dolomites', name: 'Dolomites', countryCode: 'IT' };
  if(legacy.valley){
    region.id = slugify(legacy.valley) || region.id;
    region.name = String(legacy.valley);
  }
  return region;
}

function elevationBounds(profile){
  if(!Array.isArray(profile)) return { min: null, max: null };
  const values = profile.map(point => finite(point && point.elev)).filter(value => value !== null);
  return values.length
    ? { min: Math.min(...values), max: Math.max(...values) }
    : { min: null, max: null };
}

function positionAtDistance(path, distanceKm){
  if(!Array.isArray(path) || !path.length) return null;
  if(!finite(distanceKm) || distanceKm <= 0) return path[0];
  let travelled = 0;
  for(let index = 1; index < path.length; index += 1){
    const segment = haversineKm(path[index - 1], path[index]);
    if(travelled + segment >= distanceKm && segment > 0){
      const ratio = (distanceKm - travelled) / segment;
      return [
        path[index - 1][0] + (path[index][0] - path[index - 1][0]) * ratio,
        path[index - 1][1] + (path[index][1] - path[index - 1][1]) * ratio,
      ];
    }
    travelled += segment;
  }
  return path[path.length - 1];
}

function pointerEscape(value){
  return String(value).replace(/~/g, '~0').replace(/\//g, '~1');
}

function collectUnknownFields(record){
  const pointers = [];
  function visit(value, path){
    if(value === null || value === 'unknown'){
      if(UNKNOWN_ROOTS.has(path.split('/')[1])) pointers.push(path);
      return;
    }
    if(Array.isArray(value)){
      value.forEach((entry, index) => visit(entry, `${path}/${index}`));
    }else if(value && typeof value === 'object'){
      Object.entries(value).forEach(([key, entry]) =>
        visit(entry, `${path}/${pointerEscape(key)}`));
    }
  }
  Object.entries(record).forEach(([key, value]) => visit(value, `/${key}`));
  return pointers;
}

function sourceId(value, index){
  const base = slugify(value) || `source-${index + 1}`;
  return base.length >= 2 ? base.slice(0, 79) : `source-${index + 1}`;
}

function sourceCategories(value){
  return Array.isArray(value) ? value.filter(category => SOURCE_CATEGORIES.has(category)) : [];
}

function legacyInputErrors(legacy){
  const id = String(legacy && legacy.id || '<missing-id>');
  const errors = [];
  function invalid(path, message){ errors.push(`${id}${path}: ${message}`); }

  if(legacy.distance !== null && legacy.distance !== undefined && finite(legacy.distance) === null){
    invalid('/legacy/distance', 'expected a finite number or null');
  }
  if(legacy.elevation !== null && legacy.elevation !== undefined && finite(legacy.elevation) === null){
    invalid('/legacy/elevation', 'expected a finite number or null');
  }
  if(legacy.terrainRank !== null && legacy.terrainRank !== undefined
    && ![0, 1, 2, 3].includes(legacy.terrainRank)){
    invalid('/legacy/terrainRank', 'expected 0, 1, 2, 3, or null');
  }
  if(legacy.safetyLevel !== null && legacy.safetyLevel !== undefined
    && !['low-risk', 'moderate', 'caution'].includes(legacy.safetyLevel)){
    invalid('/legacy/safetyLevel', 'unsupported safety level');
  }
  if(legacy.heatRisk !== null && legacy.heatRisk !== undefined
    && !['low', 'moderate', 'high'].includes(legacy.heatRisk)){
    invalid('/legacy/heatRisk', 'unsupported heat-risk state');
  }
  if(legacy.exposure !== null && legacy.exposure !== undefined
    && typeof legacy.exposure !== 'boolean'){
    invalid('/legacy/exposure', 'expected boolean, null, or an absent value');
  }

  const verified = legacy.verified && legacy.verified.categories;
  if(verified !== undefined && !Array.isArray(verified)){
    invalid('/legacy/verified/categories', 'expected an array');
  }else if(Array.isArray(verified)){
    verified.forEach((category, index) => {
      if(!REVIEW_CATEGORIES.includes(category)){
        invalid(`/legacy/verified/categories/${index}`, `unsupported verification category ${category}`);
      }
    });
  }

  if(legacy.graduation){
    if(!['in-progress', 'verified'].includes(legacy.graduation.status)){
      invalid('/legacy/graduation/status', 'expected in-progress or verified');
    }
    for(const field of ['required', 'completed']){
      if(!Array.isArray(legacy.graduation[field])){
        invalid(`/legacy/graduation/${field}`, 'expected an array');
      }else{
        legacy.graduation[field].forEach((category, index) => {
          if(!GRADUATION_CATEGORIES.has(category)){
            invalid(`/legacy/graduation/${field}/${index}`, `unsupported graduation category ${category}`);
          }
        });
      }
    }
  }

  (Array.isArray(legacy.sourceLinks) ? legacy.sourceLinks : []).forEach((source, sourceIndex) => {
    if(source.url !== null && source.url !== undefined
      && (typeof source.url !== 'string' || !/^https?:\/\//.test(source.url))){
      invalid(`/legacy/sourceLinks/${sourceIndex}/url`, 'expected an absolute HTTP(S) URL or null');
    }
    if(Array.isArray(source.categories)){
      source.categories.forEach((category, categoryIndex) => {
        if(!SOURCE_CATEGORIES.has(category)){
          invalid(
            `/legacy/sourceLinks/${sourceIndex}/categories/${categoryIndex}`,
            `unsupported source category ${category}`
          );
        }
      });
    }
  });
  return errors;
}

function sourcesFor(legacy, origin){
  const result = [];
  const used = new Set();
  function push(source){
    let id = sourceId(source.label, result.length);
    if(used.has(id)) id = `${id.slice(0, 70)}-${result.length + 1}`;
    used.add(id);
    result.push({ id, ...source });
  }

  (Array.isArray(legacy.sourceLinks) ? legacy.sourceLinks : []).forEach(source => push({
    label: String(source.label || 'Trail source'),
    url: typeof source.url === 'string' && /^https?:\/\//.test(source.url) ? source.url : null,
    provider: String(source.provider || source.label || 'External trail source').slice(0, 120),
    kind: 'official',
    retrievedAt: null,
    observedAt: isoDate(legacy.reviewedAt || (legacy.verified && legacy.verified.date)),
    categories: sourceCategories(source.categories),
    licence: null,
  }));

  if(legacy.routeSource || legacy.waymarkedtrails){
    const routeSource = legacy.routeSource || {};
    push({
      label: String(routeSource.name || 'Waymarked Trails route'),
      url: typeof legacy.waymarkedtrails === 'string' ? legacy.waymarkedtrails : null,
      provider: String(routeSource.provider || 'Waymarked Trails / OpenStreetMap'),
      kind: 'osm',
      retrievedAt: isoDate(routeSource.fetchedAt),
      observedAt: null,
      categories: ['route', 'metrics'],
      licence: 'ODbL-1.0',
    });
  }

  if(!result.length && origin === 'osm'){
    push({
      label: 'OpenStreetMap hiking relation',
      url: typeof legacy.waymarkedtrails === 'string'
        ? legacy.waymarkedtrails
        : 'https://www.openstreetmap.org/copyright',
      provider: 'OpenStreetMap contributors',
      kind: 'osm',
      retrievedAt: null,
      observedAt: null,
      categories: ['route', 'metrics'],
      licence: 'ODbL-1.0',
    });
  }

  if(!result.length){
    push({
      label: 'ORMA legacy production record',
      url: null,
      provider: 'ORMA',
      kind: 'legacy',
      retrievedAt: null,
      observedAt: null,
      categories: ['route', 'metrics', 'content'],
      licence: null,
    });
  }
  return result;
}

function reviewCategoriesFor(legacy, fields){
  const verified = new Set(
    Array.isArray(legacy.verified && legacy.verified.categories)
      ? legacy.verified.categories : []
  );
  const completed = new Set(
    Array.isArray(legacy.graduation && legacy.graduation.completed)
      ? legacy.graduation.completed : []
  );
  const valueKnown = {
    route: Array.isArray(legacy.path) && legacy.path.length >= 2,
    water: Array.isArray(legacy.waterSources),
    heat: fields.heatRisk !== 'unknown' && fields.shadePercent !== null,
    exposure: fields.exposure !== null,
    livestock: /livestock|cattle|herd|pasture|patou|guardian/i.test(`${legacy.desc || ''} ${legacy.tips || ''}`),
    surfaceHazards: Array.isArray(legacy.surfaceHazards),
    access: fields.dogAccess.status !== 'unknown',
  };
  return Object.fromEntries(REVIEW_CATEGORIES.map(category => {
    if(verified.has(category) || completed.has(category)) return [category, 'verified'];
    return [category, valueKnown[category] ? 'unreviewed' : 'unknown'];
  }));
}

function dogAccessFor(legacy){
  const text = `${legacy.desc || ''} ${legacy.tips || ''}`;
  if(/\bdogs?\s+(?:are\s+)?not\s+(?:allowed|permitted)|\bdog\s*=\s*no\b/i.test(text)){
    return { status: 'prohibited', notes: 'Legacy record explicitly states that dogs are prohibited.' };
  }
  if(/dogs?.{0,30}(?:must|stay|keep).{0,20}(?:on (?:a )?lead|leash)|leash (?:is )?required/i.test(text)){
    return { status: 'leash-required', notes: 'Legacy trail guidance states that a leash is required.' };
  }
  return { status: 'unknown', notes: null };
}

function publicationDiagnostics(legacy, stats, metrics){
  const reasons = [];
  if(!Array.isArray(legacy.path) || legacy.path.length < 2){
    reasons.push('geometry has fewer than two positions');
  }
  if(stats.maximumSegmentKm > 1){
    reasons.push(`geometry jump ${stats.maximumSegmentKm.toFixed(2)} km before point ${stats.maximumSegmentIndex}`);
  }
  if(finite(metrics.distanceKm) !== null && metrics.distanceKm > 50){
    reasons.push(`distance ${metrics.distanceKm} km exceeds the 50 km publication limit`);
  }
  if(finite(metrics.ascentM) !== null && metrics.ascentM > 4000){
    reasons.push(`ascent ${metrics.ascentM} m exceeds the 4,000 m publication limit`);
  }
  if(finite(metrics.durationMinutes) !== null && metrics.durationMinutes > 1440){
    reasons.push(`duration ${metrics.durationMinutes} minutes exceeds the 24-hour publication limit`);
  }
  return reasons;
}

function adaptLegacyTrail(legacy, options = {}){
  const inputErrors = legacyInputErrors(legacy);
  const origin = legacy.curated === false || legacy.source === 'osm' ? 'osm' : 'curated';
  const path = Array.isArray(legacy.path) ? legacy.path : [];
  const stats = geometryStats(path);
  const bounds = elevationBounds(legacy.elevationProfile);
  const metrics = {
    distanceKm: finite(legacy.distance),
    ascentM: finite(legacy.elevation),
    descentM: null,
    durationMinutes: parseDurationMinutes(legacy.hours),
    minElevationM: bounds.min,
    maxElevationM: bounds.max,
    routeType: routeType(legacy, stats),
    difficulty: Number(legacy.terrainRank) >= 3 ? 'expert'
      : Number(legacy.terrainRank) === 2 ? 'hard'
        : Number(legacy.terrainRank) === 1 ? 'moderate'
          : Number(legacy.terrainRank) === 0 ? 'easy' : 'unknown',
  };
  const suitability = {
    safetyLevel: ['low-risk', 'moderate', 'caution'].includes(legacy.safetyLevel)
      ? legacy.safetyLevel : 'unknown',
    terrainRank: [0, 1, 2, 3].includes(legacy.terrainRank) ? legacy.terrainRank : null,
    shadePercent: finite(legacy.shadeCoverage),
    heatRisk: ['low', 'moderate', 'high'].includes(legacy.heatRisk)
      ? legacy.heatRisk : 'unknown',
    exposure: typeof legacy.exposure === 'boolean' ? legacy.exposure : null,
    surfaceHazards: Array.isArray(legacy.surfaceHazards)
      ? legacy.surfaceHazards.map(String).filter(Boolean) : [],
    dogAccess: dogAccessFor(legacy),
  };
  const exclusionReasons = publicationDiagnostics(legacy, stats, metrics);
  const start = legacy.startPoint
    && finite(legacy.startPoint.lat) !== null && finite(legacy.startPoint.lng) !== null
    ? legacy.startPoint : null;
  const geometry = {
    type: 'LineString',
    coordinates: path.map(point =>
      Array.isArray(point) ? [point[1], point[0]] : point),
  };
  const verifiedCategories = reviewCategoriesFor(legacy, suitability);
  const tier = evidence.tierOf(legacy);
  const reviewedAt = isoDate(legacy.reviewedAt || (legacy.verified && legacy.verified.date));
  const reviewedBy = reviewedAt ? String(legacy.reviewedBy || 'ORMA') : null;
  const allVerified = REVIEW_CATEGORIES.every(category => verifiedCategories[category] === 'verified');
  const anyVerified = REVIEW_CATEGORIES.some(category => verifiedCategories[category] === 'verified');
  const sources = sourcesFor(legacy, origin);
  const waterPoints = (Array.isArray(legacy.waterSources) ? legacy.waterSources : [])
    .map((water, index) => {
      const position = finite(water.lat) !== null && finite(water.lng) !== null
        ? [water.lat, water.lng]
        : positionAtDistance(path, finite(water.km) === null ? 0 : water.km);
      if(!position) return null;
      return {
        id: `${String(legacy.id)}-water-${index + 1}`.slice(0, 79),
        type: 'water',
        name: String(water.label || water.name || `Water point ${index + 1}`),
        position: [position[1], position[0]],
        distanceKm: finite(water.km),
        status: verifiedCategories.water === 'verified' ? 'reviewed' : 'mapped',
        seasonal: null,
      };
    })
    .filter(Boolean);

  const record = {
    schemaVersion: '1.0.0',
    recordVersion: 1,
    id: String(legacy.id || ''),
    slug: options.slug || slugify(legacy.name) || slugify(legacy.id),
    origin,
    lifecycle: exclusionReasons.length ? 'draft' : 'published',
    name: String(legacy.name || ''),
    region: regionFor(legacy),
    geometry,
    center: [finite(legacy.lng), finite(legacy.lat)],
    trailhead: {
      position: start ? [start.lng, start.lat] : null,
      label: start ? String(start.label || 'Mapped route start') : null,
      status: start
        ? verifiedCategories.access === 'verified' ? 'reviewed' : 'mapped-suggestion'
        : 'unknown',
    },
    metrics,
    suitability,
    waypoints: waterPoints,
    content: {
      summary: typeof legacy.desc === 'string' && legacy.desc.trim() ? legacy.desc : null,
      tips: typeof legacy.tips === 'string' && legacy.tips.trim() ? legacy.tips : null,
    },
    sources,
    verification: {
      tier,
      status: allVerified && reviewedAt && reviewedBy
        ? 'verified' : anyVerified ? 'in-progress' : 'unreviewed',
      reviewedAt,
      reviewedBy,
      categories: verifiedCategories,
    },
    freshness: {
      geometryAt: isoDate(legacy.routeSource && legacy.routeSource.fetchedAt) || reviewedAt,
      safetyAt: anyVerified ? reviewedAt : null,
      accessAt: verifiedCategories.access === 'verified' ? reviewedAt : null,
    },
    provenance: {
      externalId: origin === 'osm'
        ? String(legacy.osmRelation || legacy.id || '')
        : legacy.osmRelation ? String(legacy.osmRelation) : null,
      generatedAt: isoDate(legacy.routeSource && legacy.routeSource.fetchedAt),
      generatorVersion: `legacy-adapter-${ADAPTER_VERSION}`,
    },
    unknownFields: [],
  };
  record.unknownFields = collectUnknownFields(record);
  return { record, exclusionReasons, stats, inputErrors };
}

function assignSlugs(trails){
  const seen = new Set();
  return trails.map(trail => {
    let slug = slugify(trail.name) || slugify(trail.id);
    if(seen.has(slug)) slug = `${slug}-${slugify(trail.id)}`.slice(0, 99);
    seen.add(slug);
    return slug;
  });
}

function validateCatalog(records){
  const errors = [];
  const ids = new Map();
  const slugs = new Map();
  for(const record of records){
    for(const error of validateTrailRecord(record)){
      errors.push(`${record.id || '<missing-id>'}${error}`);
    }
    if(ids.has(record.id)) errors.push(`${record.id}/id: duplicate ID also used by ${ids.get(record.id)}`);
    else ids.set(record.id, record.id);
    if(slugs.has(record.slug)) errors.push(`${record.id}/slug: duplicate slug also used by ${slugs.get(record.slug)}`);
    else slugs.set(record.slug, record.id);
  }
  return errors;
}

function buildCanonicalCatalog(trails){
  const slugs = assignSlugs(trails);
  const adapted = trails.map((trail, index) =>
    adaptLegacyTrail(trail, { slug: slugs[index] }));
  const records = adapted.map(entry => entry.record);
  return {
    records,
    errors: [
      ...adapted.flatMap(entry => entry.inputErrors),
      ...validateCatalog(records),
    ],
    excluded: adapted
      .filter(entry => entry.exclusionReasons.length)
      .map(entry => ({
        id: entry.record.id,
        slug: entry.record.slug,
        reasons: entry.exclusionReasons,
      })),
  };
}

module.exports = {
  ADAPTER_VERSION,
  slugify,
  parseDurationMinutes,
  geometryStats,
  legacyInputErrors,
  adaptLegacyTrail,
  validateCatalog,
  buildCanonicalCatalog,
};
