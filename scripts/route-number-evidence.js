'use strict';

// Where a trail's route numbers come from.
//
// This used to live inside build-regional-runtime-data.js, which meant only the
// generated site data carried routeNumberStatus. The verification campaign reads
// production trails through scripts/load-production-trails.js and so could not
// see it: 3 of 165 trail objects had the field. That matters because the gate
// every admitted trail must clear asks for supported authoritative route
// guidance, and this status is what says whether a trail can produce any.
//
// One module, used by both, so the site and the backoffice cannot disagree
// about which trails have route numbers.

const fs = require('fs');
const path = require('path');

const ROUTE_SOURCE_FILES = ['dog-friendly-routes.geojson', 'dog-friendly-routes-savoy.geojson'];

function normaliseRouteRef(value) {
  const ref = String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, '');
  return /^(?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?$/.test(ref) ? ref : null;
}

function mappedRouteEvidence(root) {
  const byRelation = new Map();
  ROUTE_SOURCE_FILES.forEach(file => {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) return;
    const collection = JSON.parse(fs.readFileSync(target, 'utf8'));
    (collection.features || []).forEach(feature => {
      const properties = feature.properties || {};
      if (properties.osm_relation == null) return;
      byRelation.set(String(properties.osm_relation), {
        ref: normaliseRouteRef(properties.ref),
        name: properties.name || null,
        url: properties.waymarkedtrails || `https://www.openstreetmap.org/relation/${properties.osm_relation}`,
      });
    });
  });
  return byRelation;
}

function applyRouteNumberEvidence(trails, root, evidence = mappedRouteEvidence(root)) {
  return trails.map(trail => {
    if (trail.routeNumberStatus) return trail;
    if (Array.isArray(trail.routeRefs) && trail.routeRefs.length) {
      return { ...trail, routeNumberStatus: 'documented' };
    }
    const mapped = evidence.get(String(trail.osmRelation));
    if (mapped && mapped.ref) return {
      ...trail,
      routeRefs: [mapped.ref],
      routeNumberStatus: 'mapped-relation-ref',
      routeNumberSource: { provider: 'Waymarked Trails / OpenStreetMap', name: mapped.name, url: mapped.url },
    };
    if (mapped) return {
      ...trail,
      routeNumberStatus: 'not-listed-in-mapped-source',
      routeNumberSource: { provider: 'Waymarked Trails / OpenStreetMap', name: mapped.name, url: mapped.url },
    };
    return { ...trail, routeNumberStatus: 'verification-pending' };
  });
}

module.exports = { ROUTE_SOURCE_FILES, normaliseRouteRef, mappedRouteEvidence, applyRouteNumberEvidence };
