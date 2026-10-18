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

function hostOf(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, ''); } catch (error) { return null; }
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

// Official route pages found by the Route Source Scout and confirmed by
// fetching the page. The OSM snapshot's `website` tag covers 51 of 148 route
// features and nothing else in the record carries one, so for the rest the page
// has to be found on the web. This is where a confirmed find lands, keyed by
// trail id, and it is the only route-source input that is not an OSM tag.
const SOURCED_ROUTE_PAGES = 'data/route-sources.json';

function sourcedRoutePages(root) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, SOURCED_ROUTE_PAGES), 'utf8'));
    return new Map(Object.entries(raw?.sources || {})
      .filter(([, entry]) => /^https:\/\//.test(String(entry?.url || '')))
      .map(([trailId, entry]) => [String(trailId), entry]));
  } catch (error) {
    // Absent is the normal state until the scout has found anything.
    return new Map();
  }
}

// What promote-osm-trails.js writes for every imported trail, from the
// relation's tags. Not a declaration: the same question asked of the map.
const PROMOTER_DERIVED_STATUS = new Set(['mapped-relation-ref', 'not-listed-in-mapped-source']);

function applyRouteNumberEvidence(trails, root, evidence = mappedRouteEvidence(root), sourced = sourcedRoutePages(root)) {
  return trails.map(trail => {
    // A confirmed official page is the best route evidence there is, so it is
    // attached whatever else the trail has -- including when the trail declares
    // its own status, because the status says what kind of route it is and this
    // says where a reader can be shown it. A declared status is never
    // overwritten; only the citable source is added.
    const page = sourced.get(String(trail.id));
    if (page) return {
      ...trail,
      routeNumberStatus: trail.routeNumberStatus || 'official-route-page',
      routeNumberSource: { provider: page.publisher || hostOf(page.url),
        name: page.name || trail.name || null, url: page.url },
    };
    // A status somebody declared stands; one the promoter derived does not.
    //
    // promote-osm-trails.js writes `mapped-relation-ref` or
    // `not-listed-in-mapped-source` on every imported trail, straight off the
    // relation's own tags. That is the map restating itself, not a person
    // saying what kind of route this is, and this return treated the two
    // alike -- so the moment the catalogue was regenerated the evidence below
    // stopped being attached. Measured 18 October 2026: 29 trails lost a real
    // authority, the SAT and the Comune di Lozzo di Cadore among them, and
    // fell back to citing the Waymarked Trails relation, which the route
    // claims cannot be made from. It is why the generated file had been left
    // stale: regenerating it quietly switched the sourcing off.
    if (trail.routeNumberStatus && !PROMOTER_DERIVED_STATUS.has(trail.routeNumberStatus)) return trail;
    const mapped = evidence.get(String(trail.osmRelation));
    // Having a number is not a reason to be denied the page.
    //
    // This returned before the mapped evidence below, so a trail that already
    // carried `routeRefs` never got the official page -- the exact fault the
    // comment under it describes and was written to fix, one line too late to
    // catch its own case. It did not show while the promoted file was stale
    // and most imported trails had no refs on record; regenerating gave 32 of
    // them their numbers and would have taken their pages away in the same
    // step. The number is kept either way; what this decides is the source.
    if (Array.isArray(trail.routeRefs) && trail.routeRefs.length && !(mapped && mapped.ref)) {
      return { ...trail, routeNumberStatus: 'documented' };
    }
    // A number and an official page are not alternatives, and taking the number
    // first threw the page away: 23 trails were filed as `mapped-relation-ref`
    // with their cited source pointing at Waymarked Trails while the snapshot
    // held a comune or alpine-club page describing the route. The route claims
    // require a source the agent can cite, an OSM relation is not one, so those
    // trails could never be verified -- osm-7548201 "Anello di Ciampeviei"
    // carried 99 blockers with route guidance missing and a Comune di Lozzo di
    // Cadore page in the snapshot the agent was never shown.
    //
    // The number is still recorded; what changes is which source is cited.
    if (mapped && mapped.ref) return {
      ...trail,
      routeRefs: [mapped.ref],
      // The number stays the stronger identity, which is what this status is
      // about and what "a number outranks a page" settled.
      routeNumberStatus: 'mapped-relation-ref',
      // The cited source is a different question, and taking the relation here
      // threw the page away. Waymarked Trails is not a source the route claims
      // can cite -- an OSM relation records that a path exists, not how to walk
      // it -- so where the snapshot also holds an official page, that is what
      // the agent is given. 23 trails were in this position, their cited source
      // pointing at OSM while a comune or alpine-club page sat unused in the
      // same record: osm-7548201 "Anello di Ciampeviei" carried 99 blockers
      // with route guidance missing and a Comune di Lozzo di Cadore page the
      // agent was never shown. The relation still reaches it as
      // `waymarkedtrails`, so this adds evidence rather than replacing it.
      routeNumberSource: mapped.website
        ? { provider: mapped.website.host, name: mapped.name, url: mapped.website.url }
        : { provider: 'Waymarked Trails / OpenStreetMap', name: mapped.name, url: mapped.url },
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

module.exports = {PROMOTER_DERIVED_STATUS,
  SOURCED_ROUTE_PAGES, sourcedRoutePages, hostOf, ROUTE_SOURCE_FILES, normaliseRouteRef, officialRoutePage, waymarkDescription, mappedRouteEvidence, applyRouteNumberEvidence };
