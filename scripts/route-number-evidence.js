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

// A route with no number is not a route with no identity. 100 of 165 trails
// carry no `ref` and were all filed as "nobody can number this route", which
// ranked them below everything and left them permanently unverifiable. But the
// snapshot already collects `website`, and for 21 of them it is an official
// route page -- a tourism board, a comune, the operator that signs the route.
//
// That is precisely what the gate offers unnumbered routes: the logistics agent
// is told to use the official route description to give an ordered landmark
// sequence when no number applies. The URL was being collected and thrown away
// one step before the agent that needs it.
//
// Only https, because the gate will not accept a source that is not.
// A route with neither a number nor a page can still be signed on the ground,
// and OSM records what the sign looks like. `osmc:symbol` is
// waycolour:background:foreground:text:textcolour, so
// "red:red:white_bar:AS:black" is a white bar on red marked AS -- which is
// exactly how a walker follows it, and what the agent needs in order to say so.
// Unrecognised shapes keep the raw value rather than being dropped: an
// undecoded waymark is still evidence the route is signed.
const WAYMARK_SHAPES = {
  bar: 'bar', stripe: 'bar', dot: 'dot', circle: 'circle', round: 'circle',
  cross: 'cross', diamond: 'diamond', triangle: 'triangle', arch: 'arch', frame: 'frame',
};

function waymarkPart(value) {
  const parts = String(value || '').trim().toLowerCase().split('_');
  if (!parts[0]) return null;
  const colour = parts[0];
  const shape = parts.slice(1).map(part => WAYMARK_SHAPES[part] || part).join(' ');
  return shape ? `${colour} ${shape}` : colour;
}

function waymarkDescription(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const [, background, foreground, text] = raw.split(':');
  const front = waymarkPart(foreground);
  const back = waymarkPart(background);
  const mark = String(text || '').trim();
  const face = front && back ? `${front} on ${back}` : front || back || null;
  if (!face) return { osmc: raw, described: raw };
  return { osmc: raw, described: mark ? `${face}, marked "${mark}"` : face };
}

function officialRoutePage(value) {
  const url = String(value == null ? '' : value).trim();
  if (!/^https:\/\//.test(url)) return null;
  try {
    return { url, host: new URL(url).hostname.replace(/^www\./, '') };
  } catch (error) {
    return null;
  }
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
        website: officialRoutePage(properties.website),
        waymark: waymarkDescription(properties.symbol),
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
    // No number, but an official page describing the route. The OSM relation is
    // still passed to the agent separately as `waymarkedtrails`, so pointing the
    // cited source at the official page adds evidence rather than replacing it.
    // The host is the publisher, not a formal authority: the agent is told to
    // confirm against the source and cite what it actually verified.
    if (mapped && mapped.website) return {
      ...trail,
      routeNumberStatus: 'official-route-page',
      routeNumberSource: { provider: mapped.website.host, name: mapped.name, url: mapped.website.url },
    };
    // No number and no page, but a waymark: the route is signed on the ground and
    // OSM records the sign. That is not a document the agent can read, so it
    // ranks below an official page -- but it is evidence, so it ranks above
    // "nobody has looked".
    if (mapped && mapped.waymark) return {
      ...trail,
      routeNumberStatus: 'waymarked-route',
      routeWaymark: mapped.waymark,
      routeNumberSource: { provider: 'OpenStreetMap waymark survey', name: mapped.name, url: mapped.url },
    };
    if (mapped) return {
      ...trail,
      routeNumberStatus: 'not-listed-in-mapped-source',
      routeNumberSource: { provider: 'Waymarked Trails / OpenStreetMap', name: mapped.name, url: mapped.url },
    };
    return { ...trail, routeNumberStatus: 'verification-pending' };
  });
}

module.exports = { ROUTE_SOURCE_FILES, normaliseRouteRef, officialRoutePage, waymarkDescription, mappedRouteEvidence, applyRouteNumberEvidence };
